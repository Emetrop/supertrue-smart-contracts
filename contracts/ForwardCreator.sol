//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol';
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import '@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol';
import '@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol';
import './ForwardNFT.sol';
import "./interfaces/IConfig.sol";

// import "hardhat/console.sol";

contract ForwardCreator is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using ECDSAUpgradeable for bytes32;
    using StringsUpgradeable for uint256;

    // ============ Storage ============

    CountersUpgradeable.Counter private atArtistId;
    // address used for signature verification, changeable by owner
    // address public admin;
    address public beaconAddress;
    address private _CONFIG;    //Configuration Contract
    
    // registry of created contracts
    mapping(uint256 => address) private artistContracts;
    string public baseURI;

    // ============ Events ============

    /// Emitted when an Artist is created
    event CreatedArtist(uint256 artistId, string name, string symbol, address indexed artistAddress);

    // ============ Functions ============

    /// Initializes factory
    function initialize() public initializer {
        __Ownable_init_unchained();

        // set up beacon with msg.sender as the owner
        UpgradeableBeacon _beacon = new UpgradeableBeacon(address(new ForwardNFT()));
        // _beacon.transferOwnership(msg.sender);   //Nope. Should be owned by this contract to make sure changes are tracked
        beaconAddress = address(_beacon);
        
        baseURI = "https://us-central1-supertrue-5bc93.cloudfunctions.net/api/artist/";
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
     * TODO: Test / DEPRECATE & Inherit
     */
    function transferOwnership(address newOwner) public override onlyOwner {
        //Transfer This Contract's Ownership
        _transferOwnership(newOwner);
        //Transfer Beacon's Ownership
        // UpgradeableBeacon(beaconAddress).transferOwnership(newOwner);    //CANCELLED
        //Config's (Protocol) Ownership
        IConfig(_CONFIG).transferOwnership(newOwner);
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
     * Set Contract's Base URI
     */
    function setBaseURI(string memory baseURI_) public {
        require(owner() == _msgSender() || isAdmin(_msgSender()), 'UNAUTHORIZED');
        baseURI = baseURI_;
    }

    /** 
     * Creates a new artist contract
     * @param name Name of the artist
     * @param instagram Instagram of the artist
     */
    function createArtist(
        string memory name,
        string memory instagram
    ) public returns (address, uint256) {
        //Validate Input
        require(bytes(name).length > 0, "Empty name");
        require(bytes(instagram).length > 0, "Empty instagram");

        atArtistId.increment();
        uint256 id = atArtistId.current();
        // string memory collectionName = string(abi.encodePacked("SuperTrue ", id.toString()));
        string memory collectionName = string(abi.encodePacked(name, " Super True Fans"));
        string memory symbol = string(abi.encodePacked("ST", id.toString()));

        //TODO: Centralize baseURI
        string memory baseURI_ = string(abi.encodePacked(baseURI, id.toString(), "/"));

        //Deploy 
        BeaconProxy proxy = new BeaconProxy(
            beaconAddress,
            abi.encodeWithSelector(
                ForwardNFT( payable(address(0)) ).initialize.selector,
                // admin,
                address(this),
                // 12, "SuperTrue 12", SP12, https://supertrue.fans/
                id,
                name,
                instagram,
                collectionName,
                symbol,
                baseURI_
            )
        );

        // add to registry
        artistContracts[id] = address(proxy);    //Mapping

        emit CreatedArtist(atArtistId.current(), name, symbol, address(proxy));

        return (address(proxy), id);
    }

    /// Get Artist's Contract Address by ID
    function getArtistContract(uint256 artistId) external view returns(address) {
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
