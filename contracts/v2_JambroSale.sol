// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;
import "./JambroSale.sol";

contract JambroSaleV2 is JambroSale {
    function Version() external pure returns (uint8) {
        return 2;
    }
}
