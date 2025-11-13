"""
Cases API endpoints for case management
"""
from flask import Blueprint, request, jsonify
from functools import wraps
import jwt
import os
from datetime import datetime
from ..core.db import get_db
from ..core.rbac import check_permission

cases_bp = Blueprint('cases', __name__, url_prefix='/cases')

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


@cases_bp.route('', methods=['GET'])
@token_required
def get_cases(current_user):
    """Get all cases for the current user"""
    try:
        db = get_db()
        cases_collection = db['cases']
        
        # Get cases where user is owner or member
        cases = list(cases_collection.find({
            '$or': [
                {'owner': current_user},
                {'members': current_user}
            ]
        }))
        
        # Convert ObjectId to string
        for case in cases:
            case['_id'] = str(case['_id'])
            case['id'] = case.pop('_id') if '_id' in case else case.get('id', '')
        
        return jsonify({'cases': cases}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cases_bp.route('', methods=['POST'])
@token_required
def create_case(current_user):
    """Create a new case"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('title'):
            return jsonify({'error': 'Title is required'}), 400
        
        db = get_db()
        cases_collection = db['cases']
        
        # Create case document
        case = {
            'title': data['title'],
            'description': data.get('description', ''),
            'status': data.get('status', 'active'),
            'priority': data.get('priority', 'medium'),
            'owner': current_user,
            'members': data.get('members', [current_user]),
            'documents': [],
            'createdAt': datetime.utcnow().isoformat(),
            'updatedAt': datetime.utcnow().isoformat()
        }
        
        result = cases_collection.insert_one(case)
        case['id'] = str(result.inserted_id)
        case.pop('_id', None)
        
        return jsonify({'case': case, 'message': 'Case created successfully'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cases_bp.route('/<case_id>', methods=['GET'])
@token_required
def get_case(current_user, case_id):
    """Get a specific case"""
    try:
        db = get_db()
        cases_collection = db['cases']
        
        from bson.objectid import ObjectId
        case = cases_collection.find_one({'_id': ObjectId(case_id)})
        
        if not case:
            return jsonify({'error': 'Case not found'}), 404
        
        # Check if user has access
        if case['owner'] != current_user and current_user not in case.get('members', []):
            return jsonify({'error': 'Access denied'}), 403
        
        case['id'] = str(case.pop('_id'))
        return jsonify({'case': case}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cases_bp.route('/<case_id>', methods=['PUT'])
@token_required
def update_case(current_user, case_id):
    """Update a case"""
    try:
        data = request.get_json()
        db = get_db()
        cases_collection = db['cases']
        
        from bson.objectid import ObjectId
        case = cases_collection.find_one({'_id': ObjectId(case_id)})
        
        if not case:
            return jsonify({'error': 'Case not found'}), 404
        
        # Check if user is owner
        if case['owner'] != current_user:
            return jsonify({'error': 'Only case owner can update'}), 403
        
        # Update fields
        update_data = {
            'updatedAt': datetime.utcnow().isoformat()
        }
        
        if 'title' in data:
            update_data['title'] = data['title']
        if 'description' in data:
            update_data['description'] = data['description']
        if 'status' in data:
            update_data['status'] = data['status']
        if 'priority' in data:
            update_data['priority'] = data['priority']
        if 'members' in data:
            update_data['members'] = data['members']
        
        cases_collection.update_one(
            {'_id': ObjectId(case_id)},
            {'$set': update_data}
        )
        
        updated_case = cases_collection.find_one({'_id': ObjectId(case_id)})
        updated_case['id'] = str(updated_case.pop('_id'))
        
        return jsonify({'case': updated_case, 'message': 'Case updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cases_bp.route('/<case_id>', methods=['DELETE'])
@token_required
def delete_case(current_user, case_id):
    """Delete a case"""
    try:
        db = get_db()
        cases_collection = db['cases']
        
        from bson.objectid import ObjectId
        case = cases_collection.find_one({'_id': ObjectId(case_id)})
        
        if not case:
            return jsonify({'error': 'Case not found'}), 404
        
        # Check if user is owner
        if case['owner'] != current_user:
            return jsonify({'error': 'Only case owner can delete'}), 403
        
        cases_collection.delete_one({'_id': ObjectId(case_id)})
        
        return jsonify({'message': 'Case deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cases_bp.route('/<case_id>/documents', methods=['POST'])
@token_required
def add_document_to_case(current_user, case_id):
    """Add a document to a case"""
    try:
        data = request.get_json()
        
        if not data.get('documentId'):
            return jsonify({'error': 'Document ID is required'}), 400
        
        db = get_db()
        cases_collection = db['cases']
        
        from bson.objectid import ObjectId
        case = cases_collection.find_one({'_id': ObjectId(case_id)})
        
        if not case:
            return jsonify({'error': 'Case not found'}), 404
        
        # Check if user has access
        if case['owner'] != current_user and current_user not in case.get('members', []):
            return jsonify({'error': 'Access denied'}), 403
        
        # Add document to case
        cases_collection.update_one(
            {'_id': ObjectId(case_id)},
            {
                '$addToSet': {'documents': data['documentId']},
                '$set': {'updatedAt': datetime.utcnow().isoformat()}
            }
        )
        
        return jsonify({'message': 'Document added to case successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@cases_bp.route('/<case_id>/documents/<document_id>', methods=['DELETE'])
@token_required
def remove_document_from_case(current_user, case_id, document_id):
    """Remove a document from a case"""
    try:
        db = get_db()
        cases_collection = db['cases']
        
        from bson.objectid import ObjectId
        case = cases_collection.find_one({'_id': ObjectId(case_id)})
        
        if not case:
            return jsonify({'error': 'Case not found'}), 404
        
        # Check if user has access
        if case['owner'] != current_user and current_user not in case.get('members', []):
            return jsonify({'error': 'Access denied'}), 403
        
        # Remove document from case
        cases_collection.update_one(
            {'_id': ObjectId(case_id)},
            {
                '$pull': {'documents': document_id},
                '$set': {'updatedAt': datetime.utcnow().isoformat()}
            }
        )
        
        return jsonify({'message': 'Document removed from case successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

