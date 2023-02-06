// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "./Jambro.sol";

/**
@title JambroSale NFT Contract
@author github.com/mueed98
@notice This upgradeable Contract is for sale of Jambro NFTs
*/
contract JambroSale is
    Initializable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    event ForSale(address indexed from, uint256 indexed tokenId, uint256 price);
    event Bought(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId,
        uint256 price
    );

    uint256 private saleStartTime;
    Jambro public tokenContract;

    modifier saleIsActive() {
        require(saleActive(), "Sale is not Active");
        _;
    }

    struct nftStruct {
        uint256 price;
        bool forSale;
        address owner;
    }

    mapping(uint256 => nftStruct) public nftMap;

    uint256 public royalty;
    address public royaltyGetter;

    function initialize(
        address admin,
        address _royaltyGetter,
        uint256 _royalty,
        uint256 _saleStartTime,
        Jambro _tokenContract
    ) public initializer {
        require(
            _saleStartTime >= block.timestamp,
            "saleStartTime less than block time"
        );

        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);

        saleStartTime = _saleStartTime;
        tokenContract = _tokenContract;
        royalty = _royalty;
        royaltyGetter = _royaltyGetter;
    }

    //==================  External Functions    ==================//

    function withdraw(address reciever) external onlyRole(DEFAULT_ADMIN_ROLE) {
        AddressUpgradeable.sendValue(payable(reciever), address(this).balance);
    }

    //==================  Administrative Functions    ==================//

    /**     
    @notice pauses all transfer functionality of contract
    @dev can only be called by Default Admin
    */
    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**     
    @notice unpauses all transfer functionality of contract
    @dev can only be called by Default Admin
    */
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setRoyaltyGetter(
        address _royaltyGetter
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        royaltyGetter = _royaltyGetter;
    }

    function setRoyalty(uint256 _royalty) public onlyRole(DEFAULT_ADMIN_ROLE) {
        royalty = _royalty;
    }

    //==================  Public Functions    ==================//

    function saleActive() public view returns (bool) {
        return (block.timestamp >= saleStartTime);
    }

    function jambroCommission(uint256 salePrice) public view returns (uint256) {
        return (((salePrice * royalty)) / 1 ether);
    }

    function setForSale(
        uint256 tokenId,
        uint256 price
    ) public whenNotPaused nonReentrant saleIsActive {
        require(price > 0, "Price cannot be 0");
        require(
            tokenContract.ownerOf(tokenId) == msg.sender,
            "Address not owner of this token Id"
        );

        require(
            tokenContract.isApprovedOrOwner(address(this), tokenId) == true,
            "Sale Contract not approved for this NFT"
        );

        _setNFTmap(tokenId, price, msg.sender);

        emit ForSale(msg.sender, tokenId, price);
    }

    function removeFromSale(uint256 tokenId) public {
        require(
            tokenContract.ownerOf(tokenId) == msg.sender,
            "Address not owner of this token Id"
        );
        require(nftMap[tokenId].forSale == true, "NFT not for Sale");

        nftMap[tokenId].forSale = false;
    }

    function buy(
        uint256 tokenId
    ) public payable whenNotPaused nonReentrant saleIsActive {
        nftStruct memory nft = nftMap[tokenId];
        delete nftMap[tokenId];

        require(nft.forSale == true, "NFT not for Sale");
        require(nft.price == msg.value, "Value not equal to sale price");

        uint256 commission = jambroCommission(nft.price);
        AddressUpgradeable.sendValue(payable(royaltyGetter), commission);
        AddressUpgradeable.sendValue(
            payable(nft.owner),
            msg.value - commission
        );

        tokenContract.safeTransferFrom(nft.owner, msg.sender, tokenId);

        emit Bought(nft.owner, msg.sender, tokenId, nft.price);
    }

    /**     
    @notice override needed by UUPS proxy
    */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    //==================  Internal Functions    ==================//

    function _setNFTmap(
        uint256 tokenId,
        uint256 price,
        address owner
    ) internal {
        nftMap[tokenId] = nftStruct(price, true, owner);
    }

    /**     
    @notice override needed by UUPS proxy
    */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
