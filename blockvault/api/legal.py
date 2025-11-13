"""
Legal API endpoints for legal document management,
signatures, redaction, and ZKML analysis
"""
from flask import Blueprint, request, jsonify
from functools import wraps
import jwt
import os
from datetime import datetime
from ..core.db import get_db

legal_bp = Blueprint('legal', __name__, url_prefix='/legal')

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


@legal_bp.route('/documents', methods=['GET'])
@token_required
def get_legal_documents(current_user):
    """Get all legal documents for the current user"""
    try:
        db = get_db()
        legal_docs_collection = db['legal_documents']
        
        # Get documents where user is owner or has access
        documents = list(legal_docs_collection.find({
            '$or': [
                {'owner': current_user},
                {'accessList': current_user}
            ]
        }))
        
        # Convert ObjectId to string
        for doc in documents:
            doc['_id'] = str(doc['_id'])
            doc['id'] = doc.pop('_id') if '_id' in doc else doc.get('id', '')
        
        return jsonify({'documents': documents}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@legal_bp.route('/documents/<doc_id>', methods=['GET'])
@token_required
def get_legal_document(current_user, doc_id):
    """Get a specific legal document"""
    try:
        db = get_db()
        legal_docs_collection = db['legal_documents']
        
        from bson.objectid import ObjectId
        document = legal_docs_collection.find_one({'_id': ObjectId(doc_id)})
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Check access
        if document['owner'] != current_user and current_user not in document.get('accessList', []):
            return jsonify({'error': 'Access denied'}), 403
        
        document['id'] = str(document.pop('_id'))
        return jsonify({'document': document}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@legal_bp.route('/signatures/requests', methods=['GET'])
@token_required
def get_signature_requests(current_user):
    """Get signature requests for the current user"""
    try:
        db = get_db()
        signatures_collection = db['signature_requests']
        
        # Get requests where user is a signer
        requests = list(signatures_collection.find({
            'signers.address': current_user
        }))
        
        for req in requests:
            req['_id'] = str(req['_id'])
            req['id'] = req.pop('_id') if '_id' in req else req.get('id', '')
        
        return jsonify({'requests': requests}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@legal_bp.route('/signatures/requests/<request_id>/sign', methods=['POST'])
@token_required
def sign_document(current_user, request_id):
    """Sign a document"""
    try:
        data = request.get_json()
        
        if not data.get('signature'):
            return jsonify({'error': 'Signature is required'}), 400
        
        db = get_db()
        signatures_collection = db['signature_requests']
        
        from bson.objectid import ObjectId
        request_doc = signatures_collection.find_one({'_id': ObjectId(request_id)})
        
        if not request_doc:
            return jsonify({'error': 'Signature request not found'}), 404
        
        # Update signer status
        signatures_collection.update_one(
            {
                '_id': ObjectId(request_id),
                'signers.address': current_user
            },
            {
                '$set': {
                    'signers.$.signed': True,
                    'signers.$.signedAt': datetime.utcnow().isoformat(),
                    'signers.$.signature': data['signature']
                }
            }
        )
        
        return jsonify({'message': 'Document signed successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@legal_bp.route('/signatures/sent', methods=['GET'])
@token_required
def get_sent_signature_requests(current_user):
    """Get signature requests sent by the current user"""
    try:
        db = get_db()
        signatures_collection = db['signature_requests']
        
        requests = list(signatures_collection.find({
            'requester': current_user
        }))
        
        for req in requests:
            req['_id'] = str(req['_id'])
            req['id'] = req.pop('_id') if '_id' in req else req.get('id', '')
        
        return jsonify({'requests': requests}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@legal_bp.route('/redactions', methods=['POST'])
@token_required
def create_redaction(current_user):
    """Create a redacted version of a document"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('documentId') or not data.get('redactionRules'):
            return jsonify({'error': 'Document ID and redaction rules are required'}), 400
        
        db = get_db()
        redactions_collection = db['redactions']
        
        # Create redaction record
        redaction = {
            'originalDocumentId': data['documentId'],
            'owner': current_user,
            'redactionRules': data['redactionRules'],
            'createdAt': datetime.utcnow().isoformat(),
            'status': 'pending'
        }
        
        result = redactions_collection.insert_one(redaction)
        redaction['id'] = str(result.inserted_id)
        redaction.pop('_id', None)
        
        return jsonify({'redaction': redaction, 'message': 'Redaction created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@legal_bp.route('/analysis', methods=['POST'])
@token_required
def analyze_document(current_user):
    """Analyze a document using ZKML"""
    try:
        data = request.get_json()
        
        if not data.get('documentId') or not data.get('analysisType'):
            return jsonify({'error': 'Document ID and analysis type are required'}), 400
        
        db = get_db()
        analysis_collection = db['document_analysis']
        
        # Create analysis record
        analysis = {
            'documentId': data['documentId'],
            'owner': current_user,
            'analysisType': data['analysisType'],
            'model': data.get('model', 'default'),
            'status': 'pending',
            'createdAt': datetime.utcnow().isoformat()
        }
        
        result = analysis_collection.insert_one(analysis)
        analysis['id'] = str(result.inserted_id)
        analysis.pop('_id', None)
        
        # TODO: Trigger actual ZKML analysis
        
        return jsonify({'analysis': analysis, 'message': 'Analysis started'}), 202
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@legal_bp.route('/analysis/<analysis_id>', methods=['GET'])
@token_required
def get_analysis(current_user, analysis_id):
    """Get analysis results"""
    try:
        db = get_db()
        analysis_collection = db['document_analysis']
        
        from bson.objectid import ObjectId
        analysis = analysis_collection.find_one({'_id': ObjectId(analysis_id)})
        
        if not analysis:
            return jsonify({'error': 'Analysis not found'}), 404
        
        if analysis['owner'] != current_user:
            return jsonify({'error': 'Access denied'}), 403
        
        analysis['id'] = str(analysis.pop('_id'))
        return jsonify({'analysis': analysis}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

