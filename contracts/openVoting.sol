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
@title wrpVote Open Voting Contract
@author github.com/mueed98
@notice This upgradeable Contract is for vote
*/
contract openVoting is
    Initializable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    event CohortSetup(uint256 id, string name, address admin);
    event ProposalSetup(address from, uint256 proposalId);
    event Voted(address from, uint256 proposalId);

    using MerkleProof for bytes32[];
    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private proposalCounter;

    IERC20 public tokenContract;

    address public TECH_ADMIN;
    address public DEFAULT_ADMIN_ROLE;

    struct proposal {
        string objective;
        address proposedBy;
        uint256 proposalTime;
        uint256 votingTime;
        bool exists;
    }

    mapping(uint256 => mapping(address => bool)) public proposalVotingMap;
    mapping(uint256 => CountersUpgradeable.Counter) public proposalVotingCount;

    mapping(uint256 => proposal) public proposalMap;

    mapping(address => mapping(uint256 => bool)) public changeDefaultAdminMap;

    modifier onlyDewHolder() {
        require(tokenContract.balanceOf(msg.sender) > 0, "Dew Balance is 0");
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

    function makeProposal(
        string memory _objective,
        uint256 _votingTime
    ) public onlyDewHolder returns (uint256) {
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

        return proposalCount;
    }

    function vote(uint256 _proposalId) public onlyDewHolder {
        require(
            proposalMap[_proposalId].votingTime +
                proposalMap[_proposalId].proposalTime >
                block.timestamp,
            "Voting Not Active"
        );
        require(
            proposalVotingMap[_proposalId][msg.sender] == false,
            "Already Voted"
        );

        proposalVotingMap[_proposalId][msg.sender] = true;
        proposalVotingCount[_proposalId].increment();

        emit Voted(msg.sender, _proposalId);
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

        return proposalVotingCount[_proposalId].current();
    }

    function totalProposals() public view returns (uint256) {
        return proposalCounter.current();
    }

    function canVote() public view returns (bool) {
        return tokenContract.balanceOf(msg.sender) > 0;
    }

    /**     
    @notice override needed by UUPS proxy
    */
    // function supportsInterface(bytes4 interfaceId) public view returns (bool) {
    //     return super.supportsInterface(interfaceId);
    // }

    //==================  Internal Functions    ==================//

    /**     
    @notice override needed by UUPS proxy
    */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(TECH_ADMIN) {}
}
