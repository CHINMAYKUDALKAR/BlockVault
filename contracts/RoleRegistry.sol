// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RoleRegistry - Minimal RBAC contract for BlockVault
/// @notice Stores a global role for each address. Admins can assign roles.
contract RoleRegistry {
    enum Role {
        None,
        Viewer,
        Owner,
        Admin
    }

    address public immutable registryOwner;
    mapping(address => Role) private _roles;

    event RoleUpdated(address indexed user, Role role);

    modifier onlyAdmin() {
        require(msg.sender == registryOwner || _roles[msg.sender] == Role.Admin, "not admin");
        _;
    }

    constructor() {
        registryOwner = msg.sender;
        _roles[msg.sender] = Role.Admin;
        emit RoleUpdated(msg.sender, Role.Admin);
    }

    /// @notice Returns the role assigned to `user`.
    function roleOf(address user) external view returns (Role) {
        Role role = _roles[user];
        if (role == Role.None && user == registryOwner) {
            // implicit admin for deployer even if mapping reset
            return Role.Admin;
        }
        return role;
    }

    /// @notice Assign a single role.
    function setRole(address user, Role role) external onlyAdmin {
        _roles[user] = role;
        emit RoleUpdated(user, role);
    }

    /// @notice Assign multiple roles in batch (lengths must match).
    function setRoles(address[] calldata users, Role[] calldata roles) external onlyAdmin {
        require(users.length == roles.length, "length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            _roles[users[i]] = roles[i];
            emit RoleUpdated(users[i], roles[i]);
        }
    }

    /// @notice Allows admins to transfer admin rights to another address.
    function promoteAdmin(address user) external onlyAdmin {
        require(user != address(0), "zero addr");
        _roles[user] = Role.Admin;
        emit RoleUpdated(user, Role.Admin);
    }

    /// @notice Allows an admin to clear someone's role back to None.
    function clearRole(address user) external onlyAdmin {
        delete _roles[user];
        emit RoleUpdated(user, Role.None);
    }
}
