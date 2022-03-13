//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import '@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol';
import '@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol';

import './SuperTrueNFT.sol';
import "./interfaces/IConfig.sol";

/**
 * @dev Beacon Proxy Factory
 */
contract SuperTrueCreator is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using StringsUpgradeable for uint256;

    // ============ Storage ============

    CountersUpgradeable.Counter private atArtistId;
    // address used for signature verification, changeable by owner
    // address public admin;   //DEPRECATED
    address public beaconAddress;
    address private _CONFIG;    //Configuration Contract


    // registry of created contracts
    mapping(uint256 => address) private artistContracts;
    mapping(bytes32 => uint256) private artistGUID;   //Index Unique Artist IDs

    // ============ Events ============

    /// Emitted when an Artist is created
    event CreatedArtist(uint256 artistId, string name, string symbol, address indexed artistAddress);

    // ============ Functions ============

    /// Initializes factory
    function initialize(address config, address nftContract) public initializer {
        //Set Config Address
        _CONFIG = config;

        // __Ownable_init_unchained();  //Set Ownership to Sender   //No Longer Necessary - Owner Forward to Config
        // baseURI = "https://us-central1-supertrue-5bc93.cloudfunctions.net/api/artist/";

        //init beacon
        UpgradeableBeacon _beacon = new UpgradeableBeacon(nftContract);
        beaconAddress = address(_beacon);
    }

    /**
     * Get Configurations Contract Address
     */
    function getConfig() public view returns (address) {
        return _CONFIG;
    }

    /**
     * @dev Function to check if address is admin
     */
    function isAdmin(address account) public view returns (bool) {
        address configContract = getConfig();
        return IConfig(configContract).isAdmin(account);
    }

    /**
     * @dev Transfers ownership of all contract in protocol
     * Can only be called by the current owner.
     * TODO: DEPRECATE & Inherit

    function transferOwnership(address newOwner) public override onlyOwner {
        //Transfer This Contract's Ownership
        _transferOwnership(newOwner);
        //Config's (Protocol) Ownership
        IConfig(_CONFIG).transferOwnership(newOwner);
    }
    */

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view override returns (address) {
        address configContract = getConfig();
        return IConfig(configContract).owner();
    }


    /**
     * Set Configurations Contract Address
     */
    function setConfig(address _config) public onlyOwner {
        //String Match - Validate Contract's Designation
        require(keccak256(abi.encodePacked(IConfig(_config).role())) == keccak256(abi.encodePacked("SupertrueConfig")), "Invalid Config Contract");
        //Set
        _CONFIG = _config;
    }

    /**
     * Creates a new artist contract
     * @param name Name of the artist
     * @param instagram Instagram of the artist
     * @param guid unique global identifier (Instagram ID)
     */
    function createArtist(
        string memory name,
        string memory instagram,
        string calldata guid
    ) public returns (address, uint256) {
        //Validate Input
        require(bytes(name).length > 0, "Empty name");
        require(bytes(instagram).length > 0, "Empty instagram");
        bytes32 guidHash = keccak256(bytes(guid));
        require(artistGUID[guidHash] == 0, "GUID already used");

        atArtistId.increment();
        uint256 id = atArtistId.current();
        string memory collectionName = string(abi.encodePacked("SuperTrue ", id.toString()));
        string memory symbol = string(abi.encodePacked("ST", id.toString()));

        //Deploy
        BeaconProxy proxy = new BeaconProxy(
            beaconAddress,
            abi.encodeWithSelector(
                SuperTrueNFT( payable(address(0)) ).initialize.selector,
                address(this), // admin,
                // 12, "SuperTrue 12", SP12, https://supertrue.fans/
                id,
                name,
                instagram,
                collectionName,
                symbol
            )
        );

        // add to registry
        artistContracts[id] = address(proxy);
        artistGUID[guidHash] = id;

        emit CreatedArtist(atArtistId.current(), name, symbol, address(proxy));

        return (address(proxy), id);
    }

    /// Get Artist's Contract Address by ID
    function getArtistContract(uint256 artistId) external view returns(address) {
        require(artistContracts[artistId] != address(0), "Non-Existent Artist");
        return artistContracts[artistId];
    }
    function getArtistContractByGUID(uint256 artistId) external view returns(address) {
        require(artistContracts[artistId] != address(0), "Non-Existent Artist");
        return artistContracts[artistId];
    }

    /// Define Who Can Upgrade
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// Upgrade Beacon Implementation
    function upgradeBeacon(address _newImplementation) public onlyOwner {
        UpgradeableBeacon(beaconAddress).upgradeTo(_newImplementation);
        beaconAddress = _newImplementation;
    }

}
