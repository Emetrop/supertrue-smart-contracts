// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../SupertrueNFT.sol";
import "../interfaces/ISupertrueConfig.sol";
import "../interfaces/ISupertrueNFT.sol";

import "../libraries/EIP712.sol";
import "../libraries/LibDiamond.sol";

import "./SupertrueHubStorage.sol";
import "./SupertrueConfigStorage.sol";

/**
 * Supertrue hub facet
 */
contract SupertrueHubFacet {
    using Strings for uint256;

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

    // ============ Functions ============

    function _configStorage() private pure returns (SupertrueConfigStorage.Layout storage) {
        return SupertrueConfigStorage.layout();
    }

    function _hubStorage() private pure returns (SupertrueHubStorage.Layout storage) {
        return SupertrueHubStorage.layout();
    }

    /**
     * Get config contract address
     */
    function getConfig() public view returns (address) {
        return address(this);
    }

    /**
     * Get current native token price in USD cents
     */
    function getTokenPrice() public view returns (uint256) {
        return _configStorage().tokenPrice;
    }

    /**
     * Get price for new collection creation
     */
    function getCreationPrice() public view returns (uint256) {
        return _configStorage().creationFee;
    }

    /**
     * Get artist contract address by instagram ID
     */
    function getArtistContractByInstagramId(string memory instagramId)
        public
        view
        returns (address)
    {
        SupertrueHubStorage.Layout storage hs = _hubStorage();
        return hs.artistIdToContractAddress[hs.instagramIdToArtistId[instagramId]];
    }

    /**
     * Get artist contract address by artist ID
     */
    function getArtistContract(uint256 artistId) public view returns (address) {
        return _hubStorage().artistIdToContractAddress[artistId];
    }

    /**
     * Get artist ID by instagram ID
     */
    function getArtistId(string memory instagramId)
        public
        view
        returns (uint256)
    {
        return _hubStorage().instagramIdToArtistId[instagramId];
    }

    /**
     * Get pubkey which signature is signed with
     */
    function getSigner(
        bytes calldata signature,
        uint256 signer,
        address account,
        string memory instagramId,
        string memory instagram
    ) public view returns (address) {
        bytes32 digest = EIP712._hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "Message(uint256 signer,address account,string instagramId,string instagram)"
                    ),
                    signer,
                    account,
                    keccak256(bytes(instagramId)),
                    keccak256(bytes(instagram))
                )
            )
        );
        return ECDSA.recover(digest, signature);
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
        string memory instagramId,
        address artistAccount
    ) private returns (address artistContractAddress, uint256 artistId) {
        SupertrueConfigStorage.Layout storage cs = _configStorage();
        SupertrueHubStorage.Layout storage hs = _hubStorage();

        uint256 id = ++hs.artistCounter;

        string memory collectionName = string(
            abi.encodePacked("Supertrue ", id.toString())
        );
        string memory symbol = string(abi.encodePacked("ST", id.toString()));

        // Deploy
        BeaconProxy proxy = new BeaconProxy(
            cs.nftBeacon,
            abi.encodeWithSelector(
                SupertrueNFT.initialize.selector,
                address(this), // admin,
                // 12, "Supertrue 12", ST12, https://supertrue.fans/
                id,
                name,
                instagram,
                instagramId,
                artistAccount,
                collectionName,
                symbol
            )
        );

        // Add to registry
        hs.artistIdToContractAddress[id] = address(proxy);
        hs.instagramIdToArtistId[instagramId] = id;

        emit ArtistCreated(
            id,
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
        SupertrueConfigStorage.Layout storage cs = _configStorage();

        require(msg.value >= cs.creationFee, "Insufficient payment");

        // we trust signers that they validated params for correctness
        require(_hubStorage().instagramIdToArtistId[instagramId] == 0, "Instagram ID exists");

        address signer1 = getSigner(signature1, 1, msg.sender, instagramId, instagram);
        require(signer1 == cs.signer1, "Invalid signature1");

        address signer2 = getSigner(signature2, 2, msg.sender, instagramId, instagram);
        require(signer2 == cs.signer2, "Invalid signature2");

        return _createArtist(name, instagram, instagramId, msg.sender);
    }

    /**
     * Creates a new artist contract gasless via relay
     * @param account Artist's account address
     * @param name Name of the artist
     * @param instagram Instagram of the artist
     * @param instagramId Unique Instagram ID
     * @param signature1 signed {instagram, id} message by signer1
     * @param signature2 signed {instagram, id} message by signer2
     */
    function createArtistRelay(
        address account,
        string memory name,
        string memory instagramId,
        string memory instagram,
        bytes calldata signature1,
        bytes calldata signature2
    ) public returns (address artistContractAddress, uint256 artistId) {
        // we trust signers that they validated params for correctness
        require(_hubStorage().instagramIdToArtistId[instagramId] == 0, "Instagram ID exists");

        require(_configStorage().relays[msg.sender], "Only relay");

        address signer1 = getSigner(signature1, 1, account, instagramId, instagram);
        require(signer1 == _configStorage().signer1, "Invalid signature1");

        address signer2 = getSigner(signature2, 2, account, instagramId, instagram);
        require(signer2 == _configStorage().signer2, "Invalid signature2");

        return _createArtist(name, instagram, instagramId, account);
    }
}
