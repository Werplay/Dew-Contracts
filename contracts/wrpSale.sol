// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "./WeRplay.sol";

/**
@title WeRplaySale NFT Contract
@author github.com/mueed98
@notice This upgradeable Contract is for sale of WeRplay Tokens
*/
contract wrpSale is
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

    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private _cohortCounter;

    uint256 private saleStartTime;
    WeRplay public tokenContract;

    struct cohort {
        string name;
        address admin;
        bool exists;
    }

    mapping(uint256 => cohort) cohortMap;
    mapping(uint256 => mapping(address => bool)) cohortMemberList;

    modifier saleIsActive() {
        require(saleActive(), "Sale is not Active");
        _;
    }
    modifier onlyCohortAdmin(uint256 _id, address _admin) {
        require(cohortMap[_id].admin == _admin, "Not Cohort Admin");
        _;
    }

    function initialize(
        address admin,
        uint256 _saleStartTime,
        WeRplay _tokenContract
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

    function setupCohort(
        uint256 _id,
        string memory _name,
        address _admin
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (cohortMap[_id].exists == false) {
            cohortMap[_id].exists = true;
            _cohortCounter.increment();
        }
        cohortMap[_id].name = _name;
        cohortMap[_id].admin = _admin;
    }

    function setMembersOfCohort(
        uint256 cohortId,
        address[] memory addresses
    ) public onlyCohortAdmin(cohortId, msg.sender) {
        for (uint256 i = 0; i < addresses.length; i++) {
            cohortMemberList[cohortId][addresses[i]] = true;
        }
    }

    //==================  Public Functions    ==================//

    function saleActive() public view returns (bool) {
        return (block.timestamp >= saleStartTime);
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

    /**     
    @notice override needed by UUPS proxy
    */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
