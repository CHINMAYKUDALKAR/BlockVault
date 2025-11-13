"""
Blockchain API endpoints for chain of custody and blockchain verification
"""
from flask import Blueprint, request, jsonify
from functools import wraps
import jwt
import os
from datetime import datetime
from ..core.db import get_db

blockchain_bp = Blueprint('blockchain', __name__, url_prefix='/blockchain')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1] if " " in auth_header else auth_header
            except IndexError:
                return jsonify({'error': 'Invalid token format'}), 401

        if not token:
            return jsonify({'error': 'Token is missing'}), 401

        try:
            data = jwt.decode(token, os.environ.get('JWT_SECRET', 'blockvault-secret-key'), algorithms=["HS256"])
            current_user = data['address']
        except Exception as e:
            return jsonify({'error': 'Token is invalid', 'details': str(e)}), 401

        return f(current_user, *args, **kwargs)
    return decorated


@blockchain_bp.route('/chain-of-custody', methods=['GET'])
@token_required
def get_chain_of_custody(current_user):
    """Get chain of custody for all documents accessible by user"""
    try:
        db = get_db()
        chain_collection = db['chain_of_custody']
        
        # Get all chain entries for documents owned by or accessible to user
        entries = list(chain_collection.find({
            '$or': [
                {'user': current_user},
                {'owner': current_user}
            ]
        }).sort('timestamp', -1))
        
        for entry in entries:
            entry['_id'] = str(entry['_id'])
            entry['id'] = entry.pop('_id') if '_id' in entry else entry.get('id', '')
        
        return jsonify({'entries': entries}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@blockchain_bp.route('/chain-of-custody/<document_id>', methods=['GET'])
@token_required
def get_document_chain(current_user, document_id):
    """Get chain of custody for a specific document"""
    try:
        db = get_db()
        chain_collection = db['chain_of_custody']
        
        # Get all chain entries for this document
        entries = list(chain_collection.find({
            'documentId': document_id
        }).sort('timestamp', 1))
        
        for entry in entries:
            entry['_id'] = str(entry['_id'])
            entry['id'] = entry.pop('_id') if '_id' in entry else entry.get('id', '')
        
        return jsonify({'entries': entries}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@blockchain_bp.route('/verify/<document_hash>', methods=['GET'])
@token_required
def verify_document(current_user, document_hash):
    """Verify a document on the blockchain"""
    try:
        # TODO: Implement actual blockchain verification
        # For now, check if document exists in database
        db = get_db()
        legal_docs_collection = db['legal_documents']
        
        document = legal_docs_collection.find_one({'docHash': document_hash})
        
        if not document:
            return jsonify({
                'verified': False,
                'message': 'Document not found on blockchain'
            }), 404
        
        return jsonify({
            'verified': True,
            'documentHash': document_hash,
            'owner': document.get('owner'),
            'timestamp': document.get('timestamp'),
            'status': document.get('status'),
            'message': 'Document verified on blockchain'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@blockchain_bp.route('/transactions', methods=['GET'])
@token_required
def get_transactions(current_user):
    """Get blockchain transactions for the current user"""
    try:
        db = get_db()
        transactions_collection = db['blockchain_transactions']
        
        transactions = list(transactions_collection.find({
            '$or': [
                {'from': current_user},
                {'to': current_user}
            ]
        }).sort('timestamp', -1).limit(100))
        
        for tx in transactions:
            tx['_id'] = str(tx['_id'])
            tx['id'] = tx.pop('_id') if '_id' in tx else tx.get('id', '')
        
        return jsonify({'transactions': transactions}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@blockchain_bp.route('/contract/status', methods=['GET'])
@token_required
def get_contract_status(current_user):
    """Get smart contract status"""
    try:
        # TODO: Implement actual contract status check
        return jsonify({
            'contractAddress': '0x...',
            'network': 'mainnet',
            'paused': False,
            'owner': current_user,
            'version': '1.0.0'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@blockchain_bp.route('/stats', methods=['GET'])
@token_required
def get_blockchain_stats(current_user):
    """Get blockchain statistics"""
    try:
        db = get_db()
        
        # Count documents
        legal_docs = db['legal_documents'].count_documents({'owner': current_user})
        
        # Count transactions
        transactions = db['blockchain_transactions'].count_documents({
            '$or': [{'from': current_user}, {'to': current_user}]
        })
        
        # Count chain entries
        chain_entries = db['chain_of_custody'].count_documents({
            '$or': [{'user': current_user}, {'owner': current_user}]
        })
        
        return jsonify({
            'totalDocuments': legal_docs,
            'totalTransactions': transactions,
            'chainEntries': chain_entries,
            'gasUsed': 0,  # TODO: Calculate actual gas used
            'lastActivity': datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

