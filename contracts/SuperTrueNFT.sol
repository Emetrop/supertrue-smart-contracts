// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

import "./interfaces/ISuperTrueCreator.sol";
import "./interfaces/IConfig.sol";
import "./interfaces/IERC20.sol";

/**
 * SuperTrue NFT
 * Version 0.6.0
 *
 */
contract SuperTrueNFT is
    ERC721PausableUpgradeable,
    IERC2981Upgradeable,
    EIP712Upgradeable
    // IERC721ReceiverUpgradeable
{
    using AddressUpgradeable for address;
    using StringsUpgradeable for uint256;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    // ============ Structs ============

    struct Artist {
        uint256 id;
        string name;
        string instagram;
        address account;
        bool blocked;
    }

    // ============ Storage ============

    // counter
    CountersUpgradeable.Counter private _tokenIds;

    // json and contract base uri
    // string private _base_uri;
    string private _contract_uri;
    address private _hub; //Hub Contract

    // address => allowedToCallFunctions
    mapping(address => bool) private _admins; //Admins of this contract

    // 3rd party royalties Request
    uint256 private _royaltyBPS; //Deafult to 10% royalties on seconday sales
    uint16 internal constant BPS_MAX = 10_000;
    // address payable private _fundingRecipient;   //Using Self

    // Artist Data
    Artist public artist;
    uint256 private _artistPending;
    mapping(address => uint256) private _artistPendingERC20;

    // Settings
    uint256 private _price; //Current Price / Base Price
    uint256 private _priceInterval; //Price Increments

    // Contract version
    string public constant version = "1";

    // bool private _paused;   //Override Pausa//TODO: Maybe move up when re-deplying

    // ============ Modifiers ============

    /**
     * @dev Throws if called by any account other than the owner or admins.
     */
    modifier onlyOwnerOrAdmin() {
        require(
            owner() == _msgSender() || isAdmin(_msgSender()),
            "Only admin or owner"
        );

        _;
    }

    /**
     * @dev Throws if called by any account other than the owner or admins.
     */
    modifier onlyOwnerOrAdminOrArtist() {
        require(
            owner() == _msgSender() ||
                isAdmin(_msgSender()) ||
                _msgSender() == artist.account,
            "Only admin or artist"
        );
        _;
    }

    /**
     * @dev Throws if called by any account other than the hub.
     */
    modifier onlyHub() {
        require(_hub == _msgSender(), "Only Hub");
        _;
    }

    // ============ Events ============

    /// Funds Withdrawal
    event Withdrawal(
        address indexed to,
        address indexed currency,
        uint256 amount
    );
    /// Claimed by Artist
    event ArtistClaimed(address artist);
    /// Artist Updated
    event ArtistUpdated(string name, string instagram, address account);
    /// Price Updated
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    /// Contract Blocked / Unblocked
    event Blocked(bool blocked);

    // ============ Methods ============

    function initialize(
        // address owner_,
        address hub_,
        uint256 artistId_,
        string memory artistName_,
        string memory artistInstagram_,
        string memory name_,
        string memory symbol_
    ) public initializer {
        __ERC721Pausable_init();
        __ERC721_init_unchained(name_, symbol_);
        __EIP712_init("SuperTrue", version);

        //Set Hub Address
        _hub = hub_;
        // _fundingRecipient = payable(owner_);

        artist.id = artistId_;
        artist.name = artistName_;
        artist.instagram = artistInstagram_;

        //Defaults
        _royaltyBPS = 1_000; //Deafult to 10% royalties on seconday sales
        _price = 0.002 ether; //Current Price / Base Price
        _priceInterval = 0.0001 ether; //Price Increments
    }

    //-- Token Price

    /**
     * @dev Get the Current Token Price
     */
    function price() external view returns (uint256) {
        return _price;
    }

    /**
     * @dev Update Token Price
     */
    function _updatePrice() private {
        uint256 oldPrice = _price;
        _price += _priceInterval;
        emit PriceUpdated(oldPrice, _price);
    }

    //-- Artist Data

    /**
     * @dev Set Artist's Details
     */
    function setArtist(string memory _name, string memory _instagram)
        public
        onlyOwnerOrAdmin
    {
        artist.name = _name;
        artist.instagram = _instagram;
        emit ArtistUpdated(artist.name, artist.instagram, artist.account);
    }

    /**
     * @dev Claim Contract - Set Artist's Account
     */
    function setArtistAccount(address account) public onlyOwnerOrAdminOrArtist {
        artist.account = account;
        emit ArtistUpdated(artist.name, artist.instagram, account);
        emit ArtistClaimed(account);
    }

    /**
     * @dev Get account address which signature is signed with
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
                    keccak256(bytes(artist.instagram)),
                    artist.id
                )
            )
        );
        return ECDSAUpgradeable.recover(digest, signature);
    }

    /**
     * @dev Claim Contract - Set Artist's Account
     */
    function claim(bytes calldata signature1, bytes calldata signature2)
        public
    {
        address configContract = ISuperTrueCreator(_hub).getConfig();

        require(
            (getSigner(signature1, 1) == IConfig(configContract).signer1()),
            "invalid signature1"
        );
        require(
            (getSigner(signature2, 2) == IConfig(configContract).signer2()),
            "invalid signature2"
        );

        artist.account = _msgSender();
        emit ArtistClaimed(_msgSender());
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        address configContract = ISuperTrueCreator(_hub).getConfig();
        return IConfig(configContract).owner();
    }

    /**
     * @dev Function to check if address is admin
     */
    function isAdmin(address account) public view returns (bool) {
        address configContract = ISuperTrueCreator(_hub).getConfig();
        return IConfig(configContract).isAdmin(account);
    }

    /**
     * @dev Fetch Treasury Data
     * Centralized Treasury Settings for all Artist Contracts
     */
    function _getTreasuryData() internal view returns (address, uint256) {
        address configContract = ISuperTrueCreator(_hub).getConfig();
        (address treasury, uint256 treasuryFee) = IConfig(configContract)
            .getTreasuryData();
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
    function pause() public onlyOwnerOrAdmin {
        _pause();
    }

    /**
     * @dev Unpauses all token transfers.
     *
     * See {ERC721Pausable} and {Pausable-_unpause}.
     */
    function unpause() public onlyOwnerOrAdmin {
        _unpause();
    }

    /**
     * @dev Returns true if the contract is paused, and false otherwise.
     */
    function paused() public view override returns (bool) {
        address configContract = ISuperTrueCreator(_hub).getConfig();
        return (IConfig(configContract).paused() ||
            super.paused() ||
            artist.blocked);
    }

    /// Get Total Supply
    function totalSupply() public view returns (uint256) {
        return _tokenIds.current();
    }

    /**
     * Block or Unblock Artist Contract
     * @dev Pause + Emit Event
     */
    function blockContract(bool blocked) public onlyOwnerOrAdmin {
        artist.blocked = blocked;
        emit Blocked(blocked);
    }

    /**
     * @dev Buy New Token
     * Single token at a time
     */
    // function mint(uint256 amount, address to) public payable whenNotPaused {
    function mint(address to) public payable whenNotPaused {
        //Validate Amount
        require(_price >= msg.value, "Insuficient Payment");
        //Handle Payment
        _handlePaymentNative(msg.value);
        //Increment Token ID
        _tokenIds.increment(); //We just put this first so that we's start with 1
        //Mint
        _safeMint(to, _tokenIds.current());
        //Update Price
        _updatePrice();
    }

    /**
     * @dev General purpose native currency reception function (donations)
     */
    receive() external payable {
        //Handle as Payment
        _handlePaymentNative(msg.value);
    }

    /**
     * @dev Handle Payments Logic -  Native Currency
     */
    function _handlePaymentNative(uint256 amount) private {
        //Fetch Treasury Data
        (address treasury, uint256 treasuryFee) = _getTreasuryData();
        //Split
        uint256 treasuryAmount = (amount * treasuryFee) / BPS_MAX;
        uint256 adjustedAmount = amount - treasuryAmount;
        if (treasuryAmount > 0) {
            //Send to Treasury
            payable(treasury).transfer(treasuryAmount);
            emit Withdrawal(treasury, address(0), treasuryAmount);
        }
        if (adjustedAmount > 0) {
            if (artist.account == address(0)) {
                //Hold for Artist
                _artistPending += adjustedAmount;
            } else {
                //Send to Artist
                payable(artist.account).transfer(adjustedAmount);
                emit Withdrawal(artist.account, address(0), adjustedAmount);
            }
        }
    }

    /**
     * @dev Handle Payments Logic - ERC20 Tokens
     */
    function _handlePaymentERC20(address currency, uint256 amount) private {
        //Fetch Treasury Data
        (address treasury, uint256 treasuryFee) = _getTreasuryData();
        //Split
        uint256 treasuryAmount = (amount * treasuryFee) / BPS_MAX;
        uint256 adjustedAmount = amount - treasuryAmount;
        if (treasuryAmount > 0) {
            //Send to Treasury
            IERC20(currency).transfer(treasury, treasuryAmount);
            emit Withdrawal(treasury, currency, treasuryAmount);
        }
        if (adjustedAmount > 0) {
            if (artist.account == address(0)) {
                //Hold for Artist
                _artistPending += adjustedAmount;
            } else {
                //Send to Artist
                IERC20(currency).transfer(artist.account, adjustedAmount);
                emit Withdrawal(artist.account, currency, adjustedAmount);
            }
        }
    }

    /**
     * @dev Withdraw Additional Funds (Not from minting)
     */
    function withdraw() external whenNotPaused onlyOwnerOrAdmin {
        require(address(this).balance > _artistPending, "No Available Balance");
        uint256 _balanceAvailable = address(this).balance - _artistPending;
        require(_balanceAvailable > 0, "No Available Balance");
        //Process any additional funds
        _handlePaymentNative(_balanceAvailable);
    }

    /**
     * @dev Send All Funds From Contract to Owner
     */
    function withdrawERC20(address currency)
        external
        whenNotPaused
        onlyOwnerOrAdmin
    {
        require(currency != address(0), "Currency Address Not Set");
        uint256 balance = IERC20(currency).balanceOf(address(this));
        uint256 _balanceAvailable = balance - _artistPendingERC20[currency];
        require(_balanceAvailable > 0, "No Available Balance");
        //Process any additional funds
        _handlePaymentERC20(currency, _balanceAvailable);
    }

    /**
     * @dev Artist Withdraw Pending Balance of Native Tokens
     */
    function artistWithdrawPending()
        external
        whenNotPaused
        onlyOwnerOrAdminOrArtist
    {
        //Validate
        require(artist.account != address(0), "Artist Account Not Set");
        require(_artistPending > 0, "No Artist Pending Balance");
        //Transfer Pending Balance
        payable(artist.account).transfer(_artistPending);
        emit Withdrawal(artist.account, address(0), _artistPending);
        //Reset Pending Balance
        _artistPending = 0;
    }

    /**
     * @dev Artist Withdraw Pending Balance of ERC20 Token
     */
    function artistWithdrawPendingERC20(address currency)
        external
        whenNotPaused
        onlyOwnerOrAdminOrArtist
    {
        //Validate
        require(artist.account != address(0), "Artist Account Not Set");
        require(_artistPendingERC20[currency] > 0, "No Artist Pending Balance");
        //Transfer Pending Balance
        IERC20(currency).transfer(
            artist.account,
            _artistPendingERC20[currency]
        );
        emit Withdrawal(
            artist.account,
            currency,
            _artistPendingERC20[currency]
        );
        //Reset Pending Balance
        _artistPendingERC20[currency] = 0;
    }

    /* Why receive ERC721? What happens with these tokens after they are received? Can they be extracted?

    // function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external pure override returns (bytes4) {
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }
*/

    //-- Royalties

    /**
     * @dev Set Royalties Requested
     */
    function setRoyalties(uint256 royaltyBPS) public onlyOwnerOrAdmin {
        require(
            royaltyBPS >= 0 && royaltyBPS <= 10_000,
            "Wrong royaltyBPS value"
        );
        _royaltyBPS = royaltyBPS;
    }

    /**
     * @dev Called with the sale price to determine how much royalty is owed and to whom.
     * @ param _tokenId - the NFT asset queried for royalty information
     * @param salePrice - the sale price of the NFT asset specified by `tokenId`
     * @return receiver - address of who should be sent the royalty payment
     * @return royaltyAmount - the royalty payment amount for `salePrice`
     */
    function royaltyInfo(uint256, uint256 salePrice)
        public
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        // if (_fundingRecipient == address(0x0)) { return (_fundingRecipient, 0); }
        // return (_fundingRecipient, (salePrice * _royaltyBPS) / 10_000);

        //Using the contract to hold royalties
        return (address(this), (salePrice * _royaltyBPS) / 10_000);
    }

    //-- URI Handling

    /**
     * @dev Overrid Default Contract URI
     */
    function setContractURI(string memory uri_)
        external
        onlyOwnerOrAdminOrArtist
    {
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
        // return _base_uri;
        address configContract = ISuperTrueCreator(_hub).getConfig();
        return
            string(
                abi.encodePacked(
                    IConfig(configContract).getBaseURI(),
                    artist.id.toString(),
                    "/"
                )
            );
    }
}
