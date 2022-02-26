//SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

//import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

/**
 * @dev ERC20 Intreface for transfer
 */
interface IERC20 {
    function transfer(address _to, uint256 _amount) external returns (bool);
}

/**
 * SuperTrue Forward NFT
 * Version 0.2.2
 */
contract ForwardNFT is OwnableUpgradeable, ERC721PausableUpgradeable, IERC2981Upgradeable, IERC721ReceiverUpgradeable {
    using AddressUpgradeable for address;
    using StringsUpgradeable for uint256;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    // ============ Structs ============

    struct Artist {
        uint256 id;
        string name;
        string instagram;
        address account;
    }

    // ============ Storage ============

    // counter
    CountersUpgradeable.Counter private _tokenIds;

    // json and contract base uri
    string private _uri;

    // address => allowedToCallFunctions
    mapping(address => bool) private _admins;

    // 3rd party royalties Request
    uint256 private _royaltyBPS;
    uint16 internal constant BPS_MAX = 10000;
    // address payable private _fundingRecipient;   //Using Self

    // Artist Data
    Artist public artist;
    uint256 public _artistPending;
    mapping(address => uint256) private _artistPendingERC20;

    // Treasury
    uint256 private _treasuryFee;
    address _treasury;
    
    // Settings
    uint256 private _priceBase = 0.002 ether;
    uint256 private _priceCurrent = 0.002 ether;
    uint256 private _priceInterval = 0.0001 ether;
    // uint256 private _amountMin = 1;
    // uint256 private _amountMax = 20;

    // Contract version
    uint256 public constant version = 1;


    // ============ Modifiers ============

    /**
     * @dev Throws if called by any account other than the owner or admins.
     */
    modifier onlyOwnerOrAdmin() {
        require(owner() == _msgSender() || _admins[_msgSender()], "Only admin or owner");
        _;
    }

    // ============ Methods ============

    function initialize (
        address owner_,
        uint256 artistId_,
        string memory artistName_,
        string memory artistInstagram_,
        string memory name_,
        string memory symbol_,
        string memory uri_
    ) public initializer {
        __ERC721Pausable_init();
        __ERC721_init_unchained(name_, symbol_);
        //Set Owner
        _transferOwnership(owner_);
        //Set URI
        _uri = uri_;
        _royaltyBPS = 1_000;    //Request for 10% royalties on seconday sales       //TODO: Test these weird numbers...
        // _fundingRecipient = payable(owner_);

        artist.id = artistId_;
        artist.name = artistName_;
        artist.instagram = artistInstagram_;
    }

    /**
     * Get the Current Token Price
     */
    function getCurrentPrice() public view returns (uint256) {
        return _priceBase + (totalSupply() * _priceInterval);
    }

    /**
     * @dev Set Artist's Details
     */
    function setArtist(string memory _name, string memory _instagram) public onlyOwnerOrAdmin {
        artist.name = _name;
        artist.instagram = _instagram;
    }

    /**
     * @dev Claim Contract - Set Artist's Account
     */
    function setArtistAccount(address account) public {
        //Owner or Adming or Artist
        require(owner() == _msgSender() || _admins[_msgSender()] || _msgSender() == artist.account, "Only admin or artist");
        artist.account = account;
    }

    /**
     * @dev Set Royalties Requested
     */
    // function setRoyalties(uint256 royaltyBPS, address payable fundingRecipient) public onlyOwner {
    function setRoyalties(uint256 royaltyBPS) public onlyOwner {
        require(royaltyBPS >= 0 && royaltyBPS <= 10_000, "Wrong royaltyBPS value");
        _royaltyBPS = royaltyBPS;
        // _fundingRecipient = fundingRecipient;
    }

    /**
    * enables an address for only admin functions
    * @param admin the address to enable
    */
    function addAdmin(address admin) external onlyOwner {
        _admins[admin] = true;
    }

    /**
    * disables an address for only admin functions
    * @param admin the address to disbale
    */
    function removeAdmin(address admin) external onlyOwner {
        _admins[admin] = false;
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

    function setBaseURI(string memory baseURI) public onlyOwner {
        _uri = baseURI;
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIds.current() - 1;
    }

   /**
     * @dev Mint Free NFTs
     */
    function reserve() public onlyOwnerOrAdmin {
        // require(_msgSender() == owner(), "Only admin or owner");     //Already Checked By Modifier
        _tokenIds.increment();
        _mint(address(this), _tokenIds.current());
    }

    /**
     * @dev Transfer Free Minted NFTs
     */
    function transferReserved(address to, uint256 tokenId) public onlyOwnerOrAdmin {
        // require(_msgSender() == owner() || _admins[_msgSender()], "Only admin or owner");      //Already Checked By Modifier
        _safeTransfer(address(this), to, tokenId, "");
    }

    /**
     * @dev Buy New Token
     * Single token at a time
     */
    // function mint(uint256 amount, address to) public payable whenNotPaused {
    function mint(address to) public payable whenNotPaused {
        // require(amount >= _amountMin, "Amount too small");
        // require(amount <= _amountMax, "Amount too big");
        // require(msg.value >= getCurrentPrice() * amount, "Not enough ETH sent");
        _handlePaymentNative(msg.value);
        //Mint    
        // for (uint256 i = 0; i < amount; i++) {
            _tokenIds.increment();  //We just put this first so that we's start with 1
            _safeMint(to, _tokenIds.current());
        // }
    }

    /**
     * @dev Fetch Treasury Data
     * TODO: Centralize Treasury Settings for all Artist Contracts
     */
    function _getTreasuryData() internal view returns (address, uint256) {
        return (_treasury, _treasuryFee);
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
        //Send to Treasury
        payable(treasury).transfer(treasuryAmount);
        if(artist.account == address(0)) {
            //Hold for Artist
            _artistPending += adjustedAmount;
        }else{
            //Send to Artist
            payable(artist.account).transfer(adjustedAmount);
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
        //Send to Treasury
        IERC20(currency).transfer(treasury, treasuryAmount);
        if(artist.account == address(0)) {
            //Hold for Artist
            _artistPending += adjustedAmount;
        }else{
            //Send to Artist
            IERC20(currency).transfer(artist.account, adjustedAmount);
        }
    }

    /**
     * @dev Withdraw Additional Funds (Not from minting)
     */
    function withdraw() external whenNotPaused{
        require(address(this).balance > _artistPending, "No Available Balance");
        uint256 _balanceAvailable = address(this).balance - _artistPending;
        require(_balanceAvailable > 0, "No Available Balance");
        //Process any additional funds
        _handlePaymentNative(_balanceAvailable);
    }

    /**
     * @dev Send All Funds From Contract to Owner
     */
    function withdrawERC20(address currency) external whenNotPaused {
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
    function artistWithdrawPending() external whenNotPaused {
        //Validate
        require(artist.account != address(0), "Artist Account Not Set");
        require(_artistPending > 0, "No Artist Pending Balance");
        //Transfer Pending Balance
        payable(artist.account).transfer(_artistPending);
        //Reset Pending Balance
        _artistPending = 0;
    }

    /**
     * @dev Artist Withdraw Pending Balance of ERC20 Token
     */
    function artistWithdrawPendingERC20(address currency) external whenNotPaused {
        //Validate
        require(artist.account != address(0), "Artist Account Not Set");
        require(_artistPendingERC20[currency] > 0, "No Artist Pending Balance");
        //Transfer Pending Balance
        IERC20(currency).transfer(artist.account, _artistPendingERC20[currency]);
        //Reset Pending Balance
        _artistPendingERC20[currency] = 0;
    }

    
    

    // function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external pure override returns (bytes4) {
        return IERC721ReceiverUpgradeable.onERC721Received.selector;

        // ? What happens with these tokens after they are received? Can they be extracted?

    }


    /**
     * @dev Called with the sale price to determine how much royalty is owed and to whom.
     * @param _tokenId - the NFT asset queried for royalty information
     * @param salePrice - the sale price of the NFT asset specified by `tokenId`
     * @return receiver - address of who should be sent the royalty payment
     * @return royaltyAmount - the royalty payment amount for `salePrice`
     */
    function royaltyInfo(uint256 _tokenId, uint256 salePrice) public view override returns (address receiver, uint256 royaltyAmount) {
        // if (_fundingRecipient == address(0x0)) {
        //     return (_fundingRecipient, 0);
        // }
        // return (_fundingRecipient, (salePrice * _royaltyBPS) / 10_000);

        //Using the contract to hold royalties
        return (address(this), (salePrice * _royaltyBPS) / 10_000);
    }

    // https://docs.opensea.io/docs/contract-level-metadata
    function contractURI() public view returns (string memory) {
        // .../storefront
        return string(abi.encodePacked(_baseURI(), 'storefront'));
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        // .../json/tokenID
        return string(abi.encodePacked(_baseURI(), "json", "/", tokenId.toString()));
    }

    /**
     * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
     * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
     * by default, can be overriden in child contracts.
     */
    function _baseURI() internal view override returns (string memory) {
        return _uri;
    }
}
