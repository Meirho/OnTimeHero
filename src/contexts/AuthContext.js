import React, { createContext } from 'react';

export const AuthContext = createContext({
  user: null,
});

export const AuthProvider = ({ children, value }) => {
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
