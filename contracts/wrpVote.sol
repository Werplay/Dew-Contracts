// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function mint(address to, uint256 amount) external;

    function burn(address to, uint256 amount) external;

    function blockTransfer(address _from, bool status) external;

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

/**
@title WeRplaySale Vote Contract
@author github.com/mueed98
@notice This upgradeable Contract is for vote
*/
contract wrpVote is
    Initializable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    event CohortSetup(uint256 id, string name, address admin);
    event ProposalSetup(address from, uint256 proposalId);
    using MerkleProof for bytes32[];
    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private cohortCounter;
    CountersUpgradeable.Counter private proposalCounter;

    IERC20 public tokenContract;
    bytes32 public constant TECH_ADMIN = keccak256("TECH_ADMIN");
    bytes32 public constant TOKEN_ADMIN = keccak256("TOKEN_ADMIN");

    address public currentAdmin;

    struct cohort {
        string name;
        address admin;
        bytes32 merkleRoot;
        bool exists;
    }

    struct proposal {
        string objective;
        address proposedBy;
        uint256 proposalTime;
        uint256 votingTime;
        bool exists;
    }

    mapping(uint256 => mapping(uint256 => bool)) proposalVotingMap;
    mapping(uint256 => proposal) public proposalMap;

    mapping(uint256 => cohort) public cohortMap;

    mapping(uint256 => bool) private changeDefaultAdminMap;

    modifier onlyCohortAdmin(uint256 _id, address _admin) {
        require(cohortMap[_id].admin == _admin, "Not Cohort Admin");
        _;
    }

    function initialize(
        address admin,
        IERC20 _tokenContract
    ) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TECH_ADMIN, admin);
        _grantRole(TOKEN_ADMIN, admin);

        _setRoleAdmin(TECH_ADMIN, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(TOKEN_ADMIN, DEFAULT_ADMIN_ROLE);

        tokenContract = _tokenContract;
    }

    //==================  External Functions    ==================//

    function withdraw(address reciever) external onlyRole(TECH_ADMIN) {
        AddressUpgradeable.sendValue(payable(reciever), address(this).balance);
    }

    //==================  Administrative Functions    ==================//

    /**     
    @notice pauses all transfer functionality of contract
    @dev can only be called by Default Admin
    */
    function pause() public onlyRole(TECH_ADMIN) {
        _pause();
    }

    /**     
    @notice unpauses all transfer functionality of contract
    @dev can only be called by Default Admin
    */
    function unpause() public onlyRole(TECH_ADMIN) {
        _unpause();
    }

    function mintTokens(
        address _to,
        uint256 _amount
    ) public onlyRole(TOKEN_ADMIN) {
        tokenContract.mint(_to, _amount);
    }

    function burnTokens(
        address _to,
        uint256 _amount
    ) public onlyRole(TOKEN_ADMIN) {
        tokenContract.burn(_to, _amount);
    }

    function blockTransfer(
        address _from,
        bool _status
    ) public onlyRole(TOKEN_ADMIN) {
        tokenContract.blockTransfer(_from, _status);
    }

    function setupCohort(
        uint256 _id,
        string memory _name,
        address _admin
    ) public onlyRole(TECH_ADMIN) {
        require(_id <= cohortCounter.current(), "Cohort Id not valid");
        if (cohortMap[_id].exists == false) {
            cohortMap[_id].exists = true;
            cohortCounter.increment();
        } else {
            revert("Cohort Already set");
        }

        cohortMap[_id].name = _name;
        cohortMap[_id].admin = _admin;
        emit CohortSetup(_id, _name, _admin);
    }

    function setMembersOfCohort(
        uint256 _cohortId,
        bytes32 _merkleRoot
    ) public onlyCohortAdmin(_cohortId, msg.sender) {
        cohortMap[_cohortId].merkleRoot = _merkleRoot;
    }

    function makeProposal(
        uint256 _cohortId,
        string memory _objective,
        uint256 _votingTime
    ) public onlyCohortAdmin(_cohortId, msg.sender) {
        require(_votingTime > 0, "Voting Time cannot be zero");
        uint256 proposalCount = proposalCounter.current();
        proposalCounter.increment();
        proposalMap[proposalCount] = proposal({
            objective: _objective,
            proposedBy: msg.sender,
            proposalTime: block.timestamp,
            votingTime: _votingTime,
            exists: true
        });

        emit ProposalSetup(msg.sender, proposalCount);
    }

    function changeDefaultAdmin(
        address _newAdmin,
        uint256 _cohortId
    ) public onlyCohortAdmin(_cohortId, msg.sender) {
        changeDefaultAdminMap[_cohortId] = true;
        uint256 votes = 0;
        for (uint256 i = 0; i < totalCohorts(); i++) {
            if (changeDefaultAdminMap[_cohortId] == true) {
                votes += 1;
            }
        }

        uint256 halfCohortCount;

        if (totalCohorts() % 2 == 0) {
            halfCohortCount = totalCohorts() / 2;
        } else {
            halfCohortCount = (totalCohorts() / 2) + 1;
        }

        if (votes >= halfCohortCount) {
            _deleteChangeDefaultAdminMap();
            _revokeRole(DEFAULT_ADMIN_ROLE, currentAdmin);
            _grantRole(DEFAULT_ADMIN_ROLE, _newAdmin);
            currentAdmin = _newAdmin;
        }
    }

    function vote(
        uint256 _proposalId,
        uint256 _cohortId
    ) public onlyCohortAdmin(_cohortId, msg.sender) {
        require(
            proposalMap[_proposalId].votingTime +
                proposalMap[_proposalId].proposalTime >
                block.timestamp,
            "Voting Not Active"
        );
        proposalVotingMap[_proposalId][_cohortId] = true;
    }

    //==================  Read Functions    ==================//

    function resultOfProposal(
        uint256 _proposalId
    ) public view returns (uint256) {
        require(
            proposalMap[_proposalId].votingTime +
                proposalMap[_proposalId].proposalTime <
                block.timestamp,
            "Voting Still Active"
        );
        uint256 votes = 0;
        for (uint256 i = 0; i < totalCohorts(); i++) {
            if (proposalVotingMap[_proposalId][i] == true) votes += 1;
        }

        return votes;
    }

    function totalCohorts() public view returns (uint256) {
        return cohortCounter.current();
    }

    function totalProposals() public view returns (uint256) {
        return proposalCounter.current();
    }

    function isMember(
        address _address,
        uint256 _cohortId,
        bytes32[] memory proof
    ) public view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(_address));
        return MerkleProof.verify(proof, cohortMap[_cohortId].merkleRoot, leaf);
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

    function _deleteChangeDefaultAdminMap() internal {
        for (uint256 i = 0; i < totalCohorts(); i++) {
            delete changeDefaultAdminMap[i];
        }
    }

    // function _deleteChangeTechAdminMap() internal {
    //     for (uint256 i = 0; i < totalCohorts(); i++) {
    //         delete changeTechAdminMap[i];
    //     }
    // }

    /**     
    @notice override needed by UUPS proxy
    */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
