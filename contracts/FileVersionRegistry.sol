// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FileVersionRegistry
 * @notice Tracks version history for encrypted files stored off-chain (IPFS/Arweave/etc.).
 *         Each record links a logical file identifier to the latest CID along with the
 *         previous CID, the caller that submitted the update, and a timestamp. This contract
 *         emits events so off-chain indexers or backends can subscribe to an immutable audit
 *         log of file version changes.
 */
contract FileVersionRegistry {
    struct VersionInfo {
        string currentCid;
        string previousCid;
        address user;
        uint256 timestamp;
    }

    // fileId => ordered list of versions (1-based index via array position)
    mapping(bytes32 => VersionInfo[]) private _versions;

    event FileVersionRecorded(
        bytes32 indexed fileId,
        uint256 indexed version,
        string currentCid,
        string previousCid,
        address indexed user,
        uint256 timestamp
    );

    error ZeroFileId();
    error EmptyCid();

    /**
     * @dev Record a new version for a logical file identifier.
     * @param fileId Deterministic identifier for the logical file (typically bytes32 hash of backend id)
     * @param currentCid IPFS/Arweave CID for the newly uploaded encrypted blob
     * @param previousCid CID of the prior version (empty string if this is the first version)
     */
    function recordVersion(
        bytes32 fileId,
        string calldata currentCid,
        string calldata previousCid
    ) external {
        if (fileId == bytes32(0)) revert ZeroFileId();
        if (bytes(currentCid).length == 0) revert EmptyCid();

        uint256 versionIndex = _versions[fileId].length;
        VersionInfo memory info = VersionInfo({
            currentCid: currentCid,
            previousCid: previousCid,
            user: msg.sender,
            timestamp: block.timestamp
        });

        _versions[fileId].push(info);

        emit FileVersionRecorded(
            fileId,
            versionIndex + 1,
            currentCid,
            previousCid,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Returns the number of versions recorded for a given file id.
     */
    function getVersionCount(bytes32 fileId) external view returns (uint256) {
        return _versions[fileId].length;
    }

    /**
     * @dev Returns the version data at a specific index (0-based).
     */
    function getVersion(
        bytes32 fileId,
        uint256 index
    ) external view returns (string memory currentCid, string memory previousCid, address user, uint256 timestamp) {
        require(index < _versions[fileId].length, "OutOfBounds");
        VersionInfo memory info = _versions[fileId][index];
        return (info.currentCid, info.previousCid, info.user, info.timestamp);
    }

    /**
     * @dev Returns the latest version for a file id, if any.
     */
    function latestVersion(
        bytes32 fileId
    ) external view returns (bool exists, uint256 version, string memory currentCid, string memory previousCid, address user, uint256 timestamp) {
        uint256 count = _versions[fileId].length;
        if (count == 0) {
            return (false, 0, "", "", address(0), 0);
        }
        VersionInfo memory info = _versions[fileId][count - 1];
        return (true, count, info.currentCid, info.previousCid, info.user, info.timestamp);
    }
}




