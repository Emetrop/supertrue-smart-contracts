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
    address public admin;
    address public beaconAddress;
    address private _CONFIG;    //Configuration Contract
    
    // registry of created contracts
    // address[] public artistContracts;
    mapping(uint256 => address) private artistContracts;
    string public baseURI;

    // ============ Events ============

    /// Emitted when an Artist is created
    event CreatedArtist(uint256 artistId, string name, string symbol, address indexed artistAddress);

    // ============ Functions ============

    /// Initializes factory
    function initialize() public initializer {
        __Ownable_init_unchained();

        // set admin for artist deployment authorization
        admin = msg.sender;

        // set up beacon with msg.sender as the owner
        UpgradeableBeacon _beacon = new UpgradeableBeacon(address(new ForwardNFT()));
        _beacon.transferOwnership(msg.sender);
        beaconAddress = address(_beacon);

        // Set artist id start to be 1 not 0
        atArtistId.increment();

        baseURI = "https://us-central1-supertrue-5bc93.cloudfunctions.net/api/artist/";
    } 

    /**
     * Get Configurations Contract Address
     */
    function getConfig() public view returns (address) {
        return _CONFIG;
    }

    // Test Function
    function getConfRole(address _config) external view onlyOwner returns (string memory) {
        return IConfig(_config).role();
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

    function setBaseURI(string memory baseURI_) public {
        require(owner() == _msgSender() || admin == _msgSender(), 'UNAUTHORIZED');
        baseURI = baseURI_;
    }


    /// Creates a new artist contract
    /// @param name Name of the artist
    /// @param instagram Instagram of the artist
    function createArtist(
        string memory name,
        string memory instagram
    ) public returns (address, uint256) {
        require(bytes(name).length > 0, "Empty name");
        require(bytes(instagram).length > 0, "Empty instagram");

        uint256 id = atArtistId.current();
        string memory collectionName = string(abi.encodePacked("SuperTrue ", id.toString()));
        string memory symbol = string(abi.encodePacked("ST", id.toString()));
        string memory baseURI_ = string(abi.encodePacked(baseURI, id.toString(), "/"));

        BeaconProxy proxy = new BeaconProxy(
            beaconAddress,
            abi.encodeWithSelector(
                ForwardNFT( payable(address(0)) ).initialize.selector,
                admin,
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
        // artistContracts.push(address(proxy));    //Array
        artistContracts[id] = address(proxy);    //Mapping

        emit CreatedArtist(atArtistId.current(), name, symbol, address(proxy));

        atArtistId.increment();

        return (address(proxy), id);
    }

    /// Sets the admin for authorizing artist deployment
    /// @param _newAdmin address of new admin
    // TODO: Use Config for Admin Func.
    function setAdmin(address _newAdmin) external {
        require(owner() == _msgSender() || admin == _msgSender(), 'UNAUTHORIZED');
        admin = _newAdmin;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
