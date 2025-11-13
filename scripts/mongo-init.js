// MongoDB Initialization Script for Docker
// This script runs when the container is first created

// Switch to the blockvault database
db = db.getSiblingDB('blockvault');

// Create application user with read/write permissions
db.createUser({
  user: 'blockvault_user',
  pwd: 'blockvault_password',  // Change this in production!
  roles: [
    {
      role: 'readWrite',
      db: 'blockvault'
    }
  ]
});

print('✅ Created blockvault_user');

// Create collections with validation
db.createCollection('files', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['owner', 'original_name', 'created_at'],
      properties: {
        owner: {
          bsonType: 'string',
          description: 'Ethereum address of file owner - required'
        },
        original_name: {
          bsonType: 'string',
          description: 'Original filename - required'
        },
        encrypted_name: {
          bsonType: 'string'
        },
        size: {
          bsonType: 'int',
          minimum: 0
        },
        file_hash: {
          bsonType: 'string'
        },
        ipfs_hash: {
          bsonType: 'string'
        },
        folder: {
          bsonType: 'string'
        },
        created_at: {
          bsonType: 'date',
          description: 'Creation timestamp - required'
        }
      }
    }
  }
});

print('✅ Created files collection with validation');

// Create other collections
const collections = [
  'shares',
  'users',
  'cases',
  'legal_documents',
  'signature_requests',
  'blockchain_transactions',
  'chain_of_custody',
  'redactions',
  'document_analysis',
  'file_access_roles'
];

collections.forEach(function(collName) {
  db.createCollection(collName);
  print('✅ Created ' + collName + ' collection');
});

// Create indexes for optimal performance
print('Creating indexes...');

// Files indexes
db.files.createIndex({ owner: 1 }, { name: 'idx_owner' });
db.files.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
db.files.createIndex({ file_hash: 1 }, { name: 'idx_file_hash', unique: true, sparse: true });
db.files.createIndex({ ipfs_hash: 1 }, { name: 'idx_ipfs_hash', sparse: true });
db.files.createIndex({ folder: 1, owner: 1 }, { name: 'idx_folder_owner' });
db.files.createIndex({ owner: 1, created_at: -1 }, { name: 'idx_owner_created' });
print('✅ Created files indexes');

// Shares indexes
db.shares.createIndex({ file_id: 1 }, { name: 'idx_file_id' });
db.shares.createIndex({ shared_by: 1 }, { name: 'idx_shared_by' });
db.shares.createIndex({ shared_with: 1 }, { name: 'idx_shared_with' });
db.shares.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
db.shares.createIndex({ file_id: 1, shared_with: 1 }, { name: 'idx_file_recipient', unique: true });
print('✅ Created shares indexes');

// Users indexes
db.users.createIndex({ address: 1 }, { name: 'idx_address', unique: true });
db.users.createIndex({ email: 1 }, { name: 'idx_email', sparse: true, unique: true });
db.users.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
print('✅ Created users indexes');

// Cases indexes
db.cases.createIndex({ case_id: 1 }, { name: 'idx_case_id', unique: true });
db.cases.createIndex({ owner: 1 }, { name: 'idx_owner' });
db.cases.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
db.cases.createIndex({ status: 1 }, { name: 'idx_status' });
db.cases.createIndex({ owner: 1, status: 1 }, { name: 'idx_owner_status' });
print('✅ Created cases indexes');

// Legal documents indexes
db.legal_documents.createIndex({ file_id: 1 }, { name: 'idx_file_id' });
db.legal_documents.createIndex({ owner: 1 }, { name: 'idx_owner' });
db.legal_documents.createIndex({ document_type: 1 }, { name: 'idx_doc_type' });
db.legal_documents.createIndex({ notarized: 1 }, { name: 'idx_notarized' });
db.legal_documents.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
print('✅ Created legal_documents indexes');

// Signature requests indexes
db.signature_requests.createIndex({ request_id: 1 }, { name: 'idx_request_id', unique: true });
db.signature_requests.createIndex({ file_id: 1 }, { name: 'idx_file_id' });
db.signature_requests.createIndex({ requester: 1 }, { name: 'idx_requester' });
db.signature_requests.createIndex({ signer: 1 }, { name: 'idx_signer' });
db.signature_requests.createIndex({ status: 1 }, { name: 'idx_status' });
db.signature_requests.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
db.signature_requests.createIndex({ deadline: 1 }, { name: 'idx_deadline' });
print('✅ Created signature_requests indexes');

// Blockchain transactions indexes
db.blockchain_transactions.createIndex({ tx_hash: 1 }, { name: 'idx_tx_hash', unique: true, sparse: true });
db.blockchain_transactions.createIndex({ user_address: 1 }, { name: 'idx_user_address' });
db.blockchain_transactions.createIndex({ tx_type: 1 }, { name: 'idx_tx_type' });
db.blockchain_transactions.createIndex({ timestamp: -1 }, { name: 'idx_timestamp' });
db.blockchain_transactions.createIndex({ file_id: 1 }, { name: 'idx_file_id', sparse: true });
print('✅ Created blockchain_transactions indexes');

// Chain of custody indexes
db.chain_of_custody.createIndex({ file_id: 1 }, { name: 'idx_file_id' });
db.chain_of_custody.createIndex({ event_type: 1 }, { name: 'idx_event_type' });
db.chain_of_custody.createIndex({ timestamp: -1 }, { name: 'idx_timestamp' });
db.chain_of_custody.createIndex({ actor: 1 }, { name: 'idx_actor' });
print('✅ Created chain_of_custody indexes');

// Redactions indexes
db.redactions.createIndex({ file_id: 1 }, { name: 'idx_file_id' });
db.redactions.createIndex({ redacted_by: 1 }, { name: 'idx_redacted_by' });
db.redactions.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
db.redactions.createIndex({ proof_hash: 1 }, { name: 'idx_proof_hash', sparse: true });
print('✅ Created redactions indexes');

// Document analysis indexes
db.document_analysis.createIndex({ file_id: 1 }, { name: 'idx_file_id' });
db.document_analysis.createIndex({ analysis_type: 1 }, { name: 'idx_analysis_type' });
db.document_analysis.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
db.document_analysis.createIndex({ requested_by: 1 }, { name: 'idx_requested_by' });
print('✅ Created document_analysis indexes');

print('');
print('========================================');
print('✅ Database initialization complete!');
print('========================================');
print('Database: blockvault');
print('User: blockvault_user');
print('Collections: ' + collections.length);
print('========================================');







