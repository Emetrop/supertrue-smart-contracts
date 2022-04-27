// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

import "./SupertrueNFT.sol";
import "./interfaces/ISupertrueConfig.sol";
import "./interfaces/ISupertrueNFT.sol";
import "./interfaces/ISupertrueNFT.sol";

/**
 * Beacon Proxy Factory
 */
contract SupertrueCreator is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    EIP712Upgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using StringsUpgradeable for uint256;

    // ============ Storage ============

    CountersUpgradeable.Counter private atArtistId;

    UpgradeableBeacon private beacon; // SupertrueNFT beacon
    ISupertrueConfig private config; // Configuration contract

    // registry of created contracts
    // values can be only added but not changed
    mapping(uint256 => address) private artistIdToContractAddress;
    // values can be only added but not changed
    mapping(string => uint256) private instagramIdToArtistId;

    // Contract version
    string public constant version = "1";

    // ============ Events ============

    /// Emitted when an artist is created
    event ArtistCreated(
        uint256 artistId,
        string symbol,
        string name,
        string instagram,
        string instagramId,
        address indexed artistAddress
    );

    /// Emitted when an artist is created
    event ArtistUpdated(uint256 artistId, string name, string instagram);

    /// Emitted when config address is changed
    event ConfigAddressChanged(address config);

    // ============ Functions ============

    /**
     * Initializes factory
     */
    function initialize(address config_, address nftContract)
        public
        initializer
    {
        __EIP712_init("Supertrue", version);

        require(
            ISupertrueConfig(config_).isSupertrueConfig(),
            "Invalid config contract"
        );

        config = ISupertrueConfig(config_);

        // Init beacon
        UpgradeableBeacon _beacon = new UpgradeableBeacon(nftContract);
        beacon = _beacon;
    }

    /**
     * Get config contract address
     */
    function getConfig() public view returns (address) {
        return address(config);
    }

    /**
     * Set configurations contract address
     */
    function setConfig(address config_) public onlyOwner {
        require(
            ISupertrueConfig(config_).isSupertrueConfig(),
            "Invalid config contract"
        );

        config = ISupertrueConfig(config_);

        emit ConfigAddressChanged(config_);
    }

    /**
     * Get price for new collection creation
     */
    function getCreationPrice() public view returns (uint256) {
        return config.getCreationFee();
    }

    /**
     * Function to check if address is admin
     */
    function isAdmin(address account) public view returns (bool) {
        return config.isAdmin(account);
    }

    /**
     * Returns the address of the current owner.
     */
    function owner() public view override returns (address) {
        return config.owner();
    }

    /**
     * Define who can upgrade
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * Get SupertrueNFT beacon address
     */
    function getBeacon() public view returns (address) {
        return address(beacon);
    }

    /**
     * Upgrade SupertrueNFT beacon implementation
     */
    function upgradeBeacon(address _newImplementation) public onlyOwner {
        beacon.upgradeTo(_newImplementation);
        beacon = UpgradeableBeacon(_newImplementation);
    }

    /**
     * Get artist's contract address by artist ID
     */
    function getArtistContract(uint256 artistId) public view returns (address) {
        require(
            artistIdToContractAddress[artistId] != address(0),
            "Artist not found"
        );
        return artistIdToContractAddress[artistId];
    }

    /**
     * Get pubkey which signature is signed with
     */
    function getSigner(
        bytes calldata signature,
        uint256 signer,
        string memory instagramId,
        string memory instagram
    ) public view returns (address) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "Message(uint256 signer,string instagramId,string instagram)"
                    ),
                    signer,
                    keccak256(bytes(instagramId)),
                    keccak256(bytes(instagram))
                )
            )
        );
        return ECDSAUpgradeable.recover(digest, signature);
    }

    /**
     * Creates a new artist contract - extracted from createArtist to avoid stack too deep error
     * @param name Name of the artist
     * @param instagram Instagram of the artist
     * @param instagramId Unique Instagram ID
     */
    function _createArtist(
        string memory name,
        string memory instagram,
        string memory instagramId
    ) private returns (address artistContractAddress, uint256 artistId) {
        atArtistId.increment();
        uint256 id = atArtistId.current();

        string memory collectionName = string(
            abi.encodePacked("Supertrue ", id.toString())
        );
        string memory symbol = string(abi.encodePacked("ST", id.toString()));

        // Deploy
        BeaconProxy proxy = new BeaconProxy(
            address(beacon),
            abi.encodeWithSelector(
                SupertrueNFT.initialize.selector,
                address(this), // admin,
                // 12, "Supertrue 12", ST12, https://supertrue.fans/
                id,
                name,
                instagram,
                instagramId,
                collectionName,
                symbol
            )
        );

        // Add to registry
        artistIdToContractAddress[id] = address(proxy);
        instagramIdToArtistId[instagramId] = id;

        emit ArtistCreated(
            atArtistId.current(),
            symbol,
            name,
            instagram,
            instagramId,
            address(proxy)
        );

        return (address(proxy), id);
    }

    /**
     * Creates a new artist contract
     * @param name Name of the artist
     * @param instagram Instagram of the artist
     * @param instagramId Unique Instagram ID
     * @param signature1 signed {instagram, id} message by signer1
     * @param signature2 signed {instagram, id} message by signer2
     */
    function createArtist(
        string memory name,
        string memory instagramId,
        string memory instagram,
        bytes calldata signature1,
        bytes calldata signature2
    ) public payable returns (address artistContractAddress, uint256 artistId) {
        require(msg.value >= getCreationPrice(), "Insufficient payment");

        require(bytes(name).length > 0, "Empty name");
        require(bytes(instagram).length > 0, "Empty instagram");
        require(bytes(instagramId).length > 0, "Empty instagram ID");

        require(instagramIdToArtistId[instagramId] == 0, "Instagram ID exists");

        address signer1 = getSigner(signature1, 1, instagramId, instagram);
        require(signer1 == config.signer1(), "Invalid signature1");

        address signer2 = getSigner(signature2, 2, instagramId, instagram);
        require(signer2 == config.signer2(), "Invalid signature2");

        return _createArtist(name, instagram, instagramId);
    }

    /**
     * Update artist's details
     * @param name Name of the artist
     * @param instagram Instagram of the artist
     * @param signature1 signed {instagram, id} message by signer1
     * @param signature2 signed {instagram, id} message by signer2
     */
    function updateArtist(
        uint256 artistId,
        string memory name,
        string memory instagram,
        bytes calldata signature1,
        bytes calldata signature2
    ) public {
        require(bytes(name).length > 0, "Empty name");
        require(bytes(instagram).length > 0, "Empty instagram");

        ISupertrueNFT artistContract = ISupertrueNFT(
            getArtistContract(artistId)
        );
        ISupertrueNFT.Artist memory artist = artistContract.getArtist();

        require(
            _msgSender() == config.owner() || _msgSender() == artist.account,
            "Only owner or artist"
        );

        address signer1 = getSigner(
            signature1,
            1,
            instagram,
            artist.instagramId
        );
        require(signer1 == config.signer1(), "Invalid signature1");

        address signer2 = getSigner(
            signature2,
            2,
            instagram,
            artist.instagramId
        );
        require(signer2 == config.signer2(), "Invalid signature2");

        artistContract.updateArtist(name, instagram);

        emit ArtistUpdated(artistId, name, instagram);
    }
}
