// src/components/Navbar.tsx

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
    const { authToken, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
            <div className="container">
                <Link className="navbar-brand" to="/">
                    PMO Inteligente
                </Link>
                <div className="d-flex">
                    {authToken ? (
                        <>
                            <Link to="/" className="btn btn-outline-light me-2">Painel</Link>
                            <button onClick={handleLogout} className="btn btn-outline-secondary">
                                Logout
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="btn btn-outline-primary">
                            Login
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
