// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

/**
@title Jambro NFT Contract
@author github.com/mueed98
@notice This upgradeable Contract is for Minting Jambro NFTs with uri different for each nft
*/
contract Jambro is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ERC721BurnableUpgradeable,
    UUPSUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private _tokenIdCounter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    function initialize(address owner) public initializer {
        __ERC721_init("Jambro", "JAMB");
        __ERC721URIStorage_init();
        __Pausable_init();
        __AccessControl_init();
        __ERC721Burnable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(MINTER_ROLE, owner);
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

    //==================  Public Functions    ==================//

    /**     
    @notice mint function to mint NFTs
    @dev can only be called by Minter
    @param to, address to whom NFT will be minted
    @param uri, string value that will be set as uri
    */
    function safeMint(address to, string memory uri)
        public
        onlyRole(MINTER_ROLE)
    {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /**     
    @notice returns uri of a tokenId
    @dev read only function
    @param tokenId, uint256 value representing tokenId of a NFT 
    */
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /**     
    @notice returns total  number tokens minted
    @dev read only function
    */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter.current();
    }

    /**     
    @notice Returns whether `spender` is allowed to manage tokenId
    @dev read only function
    @param tokenId, uint256 value representing tokenId of a NFT 
    @param spender, address that is checked for allowance 
    */
    function isApprovedOrOwner(address spender, uint256 tokenId)
        public
        view
        returns (bool)
    {
        return _isApprovedOrOwner(spender, tokenId);
    }

    /**     
    @notice override needed by UUPS proxy
    */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    //==================  Internal Functions    ==================//

    /**     
    @notice override needed by UUPS proxy
    */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    /**     
    @notice override needed by UUPS proxy
    */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    /**     
    @notice override needed by UUPS proxy
    */
    function _burn(uint256 tokenId)
        internal
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    {
        super._burn(tokenId);
    }

    //==================  Private Functions    ==================//

    //==================  Contract End    ==================//
}
