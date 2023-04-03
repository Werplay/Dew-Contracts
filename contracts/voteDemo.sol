// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
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
@title wrpVote Vote Contract
@author github.com/mueed98
@notice This upgradeable Contract is for vote
*/
contract voteDemo is
    Initializable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    event CohortSetup(uint256 id, string name, address admin);
    event ProposalSetup(address from, uint256 proposalId);
    using MerkleProof for bytes32[];
    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private cohortCounter;
    CountersUpgradeable.Counter private proposalCounter;

    IERC20 public tokenContract;

    address public TECH_ADMIN;
    address public DEFAULT_ADMIN_ROLE;

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

    mapping(uint256 => mapping(uint256 => bool)) public proposalVotingMap;

    mapping(uint256 => proposal) public proposalMap;

    mapping(uint256 => cohort) public cohortMap;

    mapping(address => mapping(uint256 => bool)) public changeDefaultAdminMap;
    mapping(uint256 => mapping(address => mapping(uint256 => bool)))
        public changeCohortAdminMap;

    modifier onlyCohortAdmin(uint256 _id, address _admin) {
        require(cohortMap[_id].admin == _admin, "Not Cohort Admin");
        _;
    }

    modifier onlyRole(address _role) {
        require(msg.sender == _role, "Caller is Missing Role");
        _;
    }

    function initialize(
        address admin,
        IERC20 _tokenContract
    ) public initializer {
        __Pausable_init();
        __UUPSUpgradeable_init();

        DEFAULT_ADMIN_ROLE = admin;
        TECH_ADMIN = admin;

        tokenContract = _tokenContract;
    }

    //==================  External Functions    ==================//

    function withdraw(address reciever) external onlyRole(TECH_ADMIN) {
        AddressUpgradeable.sendValue(payable(reciever), address(this).balance);
    }

    function changeTechAdmin(
        address _newTechAdmin
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        TECH_ADMIN = _newTechAdmin;
    }

    function batchTokenTransfer(
        address[] calldata _listOfAddresses,
        uint256 _amountForEachAddress
    ) external {
        for (uint256 i; i < _listOfAddresses.length; ++i) {
            tokenContract.transferFrom(
                msg.sender,
                _listOfAddresses[i],
                _amountForEachAddress
            );
        }
    }

    function batchNativeTransfer(
        address[] calldata _listOfAddresses,
        uint256 _amountForEachAddress
    ) external payable {
        require(
            msg.value == _listOfAddresses.length * _amountForEachAddress,
            "Value sent is less"
        );
        for (uint256 i; i < _listOfAddresses.length; ++i) {
            AddressUpgradeable.sendValue(
                payable(_listOfAddresses[i]),
                _amountForEachAddress
            );
        }
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
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenContract.mint(_to, _amount);
    }

    function burnTokens(
        address _to,
        uint256 _amount
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenContract.burn(_to, _amount);
    }

    function setupCohort(
        uint256 _id,
        string memory _name,
        address _admin
    ) public onlyRole(TECH_ADMIN) {
        require(_id < 5, "Five cohorts already setup");
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
        changeDefaultAdminMap[_newAdmin][_cohortId] = true;
        uint256 votes = 0;
        for (uint256 i = 0; i < totalCohorts(); i++) {
            if (changeDefaultAdminMap[_newAdmin][i] == true) {
                votes += 1;
            }
        }

        uint256 halfCohortCount = (totalCohorts() / 2) + 1;

        if (votes >= halfCohortCount) {
            _deleteChangeDefaultAdminMap(_newAdmin);
            DEFAULT_ADMIN_ROLE = _newAdmin;
        }
    }

    function changeCohortAdmin(
        address _newAdmin,
        uint256 _yourCohortId,
        uint256 _targetCohortId
    ) public onlyCohortAdmin(_yourCohortId, msg.sender) {
        require(
            cohortMap[_targetCohortId].admin != msg.sender,
            "Current Admin of Cohort cannot vote"
        );
        changeCohortAdminMap[_targetCohortId][_newAdmin][_yourCohortId] = true;
        uint256 votes = 0;
        for (uint256 i = 0; i < totalCohorts(); i++) {
            if (changeCohortAdminMap[_targetCohortId][_newAdmin][i] == true) {
                votes += 1;
            }
        }

        uint256 halfCohortCount = (totalCohorts() / 2) + 1;

        if (votes >= halfCohortCount) {
            _deleteChangeCohortAdminMap(_targetCohortId, _newAdmin);
            cohortMap[_targetCohortId].admin = _newAdmin;
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
    // function supportsInterface(bytes4 interfaceId) public view returns (bool) {
    //     return super.supportsInterface(interfaceId);
    // }

    //==================  Internal Functions    ==================//

    function _deleteChangeDefaultAdminMap(address _newAdmin) internal {
        for (uint256 i = 0; i < totalCohorts(); i++) {
            delete changeDefaultAdminMap[_newAdmin][i];
        }
    }

    function _deleteChangeCohortAdminMap(
        uint256 _targetCohortId,
        address _newAdmin
    ) internal {
        for (uint256 i = 0; i < totalCohorts(); i++) {
            delete changeCohortAdminMap[_targetCohortId][_newAdmin][i];
        }
    }

    /**     
    @notice override needed by UUPS proxy
    */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(TECH_ADMIN) {}
}
