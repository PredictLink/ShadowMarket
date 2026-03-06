// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IReceiver
 * @notice Interface for contracts that receive reports from Chainlink CRE.
 */
interface IReceiver {
    /**
     * @notice This function is called by the CRE DON to submit a report.
     * @param report The ABI-encoded report data.
     * @param signature The cryptographic signature(s) from the DON.
     */
    function onReport(bytes calldata report, bytes calldata signature) external;
}
