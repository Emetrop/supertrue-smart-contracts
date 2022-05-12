// SPDX-License-Identifier: MIT

pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

import "./interfaces/ISupertrueCreator.sol";
import "./interfaces/ISupertrueNFT.sol";
import "./interfaces/ISupertrueConfig.sol";

/**
 * Supertrue NFT
 * Version 0.7.0
 *
 */
contract SupertrueNFT is
    ERC721PausableUpgradeable,
    EIP712Upgradeable,
    ERC2981Upgradeable,
    ISupertrueNFT
{
    using AddressUpgradeable for address;
    using StringsUpgradeable for uint256;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    // ============ Storage ============

    // counter
    CountersUpgradeable.Counter private _tokenIds;

    // json and contract base uri
    // string private _base_uri;
    string private _contract_uri;
    address private _hub; //Hub Contract

    // address => allowedToCallFunctions
    mapping(address => bool) private _admins; //Admins of this contract

    // 3rd party royalties
    uint96 private constant _defaultRoyaltyBPS = 1_000; //10% royalties on secondary sales
    uint16 internal constant BPS_MAX = 10_000;

    // Artist Data
    Artist private _artist;
    uint256 private _artistPendingFunds;
    uint256 private _treasuryPendingFunds;

    // Settings
    uint256 private _price; //Current Price / Base Price
    uint256 private _priceInterval; //Price Increments

    // Contract version
    string public constant version = "1";

    // ============ Modifiers ============

    /**
     * @dev Throws if called by any account other than the hub.
     */
    modifier onlyHub() {
        require(_msgSender() == _hub, "Only hub");
        _;
    }

    /**
     * @dev Throws if called by any account other than the owner or admins.
     */
    modifier onlyOwner() {
        require(_msgSender() == owner(), "Only owner");
        _;
    }

    /**
     * @dev Throws if called by any account other than the owner or admins.
     */
    modifier onlyOwnerOrArtist() {
        require(
            _msgSender() == owner() || _msgSender() == _artist.account,
            "Only owner or artist"
        );
        _;
    }

    // ============ Events ============

    /// Funds Withdrawal
    event Withdrawal(
        address indexed to,
        address indexed tokenAddress, // prepared for ERC20 tokens
        uint256 amount
    );
    /// Claimed by Artist
    event ArtistClaimed(address artist);
    /// Artist Updated
    event ArtistUpdated(string name, string instagram);
    /// Contract Blocked / Unblocked
    event Blocked(bool blocked);

    // ============ Methods ============

    function initialize(
        address hub_,
        uint256 artistId_,
        string memory artistName_,
        string memory artistInstagram_,
        string memory artistInstagramId_,
        string memory name_,
        string memory symbol_
    ) public initializer {
        __ERC721_init(name_, symbol_);
        __ERC721Pausable_init();
        __EIP712_init("Supertrue", version);

        _setDefaultRoyalty(address(this), _defaultRoyaltyBPS);

        //Set Hub Address
        _hub = hub_;

        _artist.id = artistId_;
        _artist.name = artistName_;
        _artist.instagram = artistInstagram_;
        _artist.instagramId = artistInstagramId_;

        //Defaults
        _price = 0.002 ether; //Current Price / Base Price
        _priceInterval = 0.0001 ether; //Price Increments
        _artistPendingFunds = 0;
        _treasuryPendingFunds = 0;
    }

    //-- Token Price

    /**
     * @dev Get the Current Token Price
     */
    function price() external view returns (uint256) {
        return _price;
    }

    //-- Artist Data

    /**
     * @dev Get artist
     */
    function getArtist() external view override returns (Artist memory) {
        return _artist;
    }

    /**
     * @dev Set Artist's Details
     */
    function updateArtist(string memory _name, string memory _instagram)
        public
        override
        onlyHub
    {
        require(bytes(_name).length > 0, "Empty name");
        require(bytes(_instagram).length > 0, "Empty instagram");

        _artist.name = _name;
        _artist.instagram = _instagram;

        emit ArtistUpdated(_name, _instagram);
    }

    /**
     * @dev Get pubkey which signature is signed with
     */
    function getSigner(bytes calldata signature, uint256 signer)
        public
        view
        returns (address)
    {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "Message(uint256 signer,address account,string instagram,uint256 artistId)"
                    ),
                    signer,
                    _msgSender(),
                    keccak256(bytes(_artist.instagram)),
                    _artist.id
                )
            )
        );
        return ECDSAUpgradeable.recover(digest, signature);
    }

    function _config() private view returns (ISupertrueConfig) {
        return ISupertrueConfig(ISupertrueCreator(_hub).getConfig());
    }

    /**
     * @dev Claim Contract - Set Artist's Account
     */
    function claim(bytes calldata signature1, bytes calldata signature2)
        public
    {
        require(
            getSigner(signature1, 1) == _config().signer1(),
            "invalid signature1"
        );
        require(
            getSigner(signature2, 2) == _config().signer2(),
            "invalid signature2"
        );

        _artist.account = _msgSender();
        emit ArtistClaimed(_msgSender());
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _config().owner();
    }

    /**
     * @dev Fetch Treasury Data
     * Centralized Treasury Settings for all Artist Contracts
     */
    function _getTreasuryData() internal view returns (address, uint256) {
        (address treasury, uint256 treasuryFee) = _config().getTreasuryData();
        //Validate (Don't Burn Assets)
        require(
            treasuryFee == 0 || treasury != address(0),
            "Treasury Misconfigured"
        );
        return (treasury, treasuryFee);
    }

    /**
     * @dev Get Hub address
     */
    function hub() public view returns (address) {
        return _hub;
    }

    /**
     * @dev Pauses all token transfers.
     *
     * See {ERC721Pausable} and {Pausable-_pause}.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     *
     * See {ERC721Pausable} and {Pausable-_unpause}.
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view override returns (bool) {
        return (_config().paused() || super.paused() || _artist.blocked);
    }

    /// Get Total Supply
    function totalSupply() public view returns (uint256) {
        return _tokenIds.current();
    }

    /**
     * Block or Unblock Artist Contract
     * @dev Pause + Emit Event
     */
    function blockContract(bool blocked) public onlyOwner {
        _artist.blocked = blocked;
        emit Blocked(blocked);
    }

    /**
     * @dev Adjusts Pending Funds
     */
    function _splitFunds(uint256 value) private {
        (, uint256 treasuryFee) = _getTreasuryData();
        uint256 artistShare = (value * (BPS_MAX - treasuryFee)) / BPS_MAX;
        _artistPendingFunds += artistShare;
        _treasuryPendingFunds += value - artistShare;
    }

    /**
     * @dev Buy New Token
     * Single token at a time
     */
    function mint(address to) public payable whenNotPaused {
        //Validate Amount
        require(msg.value >= _price, "Insufficient Payment");
        //Increment Token ID
        _tokenIds.increment(); //We just put this first so that we start with 1
        //Mint
        _safeMint(to, _tokenIds.current());
        //Update Price
        _price += _priceInterval;
        //Update pending funds
        _splitFunds(msg.value);
    }

    /**
     * @dev General purpose native currency reception function (donations)
     */
    receive() external payable {
        _splitFunds(msg.value);
    }

    /**
     * @dev Get artist's not withdrawn funds
     */
    function artistPendingFunds() public view returns (uint256) {
        return _artistPendingFunds;
    }

    /**
     * @dev Get treasury's not withdrawn funds
     */
    function treasuryPendingFunds() public view returns (uint256) {
        return _treasuryPendingFunds;
    }

    /**
     * @dev Treasury Withdraw Pending Funds of Native Currency
     */
    function withdrawTreasury() external whenNotPaused onlyOwner {
        require(_treasuryPendingFunds > 0, "No Pending Funds");
        require(
            _treasuryPendingFunds <= address(this).balance,
            "Not Enough Funds"
        );

        (address treasury, ) = _getTreasuryData();

        require(treasury != address(0), "Treasury Account Not Set");

        uint256 treasuryFunds = _treasuryPendingFunds;

        _treasuryPendingFunds = 0;

        payable(treasury).transfer(treasuryFunds);

        emit Withdrawal(treasury, address(0), treasuryFunds);
    }

    /**
     * @dev Artist Withdraw Pending Funds of Native Currency
     */
    function withdrawArtist() external whenNotPaused onlyOwnerOrArtist {
        require(_artistPendingFunds > 0, "No Pending Funds");
        require(
            _artistPendingFunds <= address(this).balance,
            "Not Enough Funds"
        );
        require(_artist.account != address(0), "Artist Account Not Set");

        uint256 artistFunds = _artistPendingFunds;

        _artistPendingFunds = 0;

        payable(_artist.account).transfer(artistFunds);

        emit Withdrawal(_artist.account, address(0), artistFunds);
    }

    //-- Royalties

    /**
     * @dev Set Royalties Requested
     */
    function setRoyalties(uint96 royaltyBPS) public onlyOwner {
        _setDefaultRoyalty(address(this), royaltyBPS);
    }

    //-- URI Handling

    /**
     * @dev Override Default Contract URI
     */
    function setContractURI(string memory uri_) external onlyOwner {
        _contract_uri = uri_;
    }

    /**
     * @dev Contract URI
     *  https://docs.opensea.io/docs/contract-level-metadata
     */
    function contractURI() public view returns (string memory) {
        if (bytes(_contract_uri).length > 0) return _contract_uri;
        // .../storefront
        return string(abi.encodePacked(_baseURI(), "storefront"));
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );
        // .../json/tokenID
        return
            string(
                abi.encodePacked(_baseURI(), "json", "/", tokenId.toString())
            );
    }

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
     * by default, can be overriden in child contracts.
     */
    function _baseURI() internal view override returns (string memory) {
        return
            string(
                abi.encodePacked(
                    _config().getBaseURI(),
                    _artist.id.toString(),
                    "/"
                )
            );
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
