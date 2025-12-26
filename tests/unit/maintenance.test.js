/**
 * Unit tests for maintenance mode middleware
 */

// Mock the store module before requiring maintenance
jest.mock('../../store', () => ({
  read: jest.fn(),
}));

const { read } = require('../../store');
const maintenanceMode = require('../../middleware/maintenance');

describe('Maintenance Mode Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow access when maintenance mode is disabled', () => {
    read.mockReturnValue({ maintenance: { enabled: false } });

    const req = { path: '/index.html' };
    const res = {};
    const next = jest.fn();

    maintenanceMode(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow access to /verify.html during maintenance mode', () => {
    read.mockReturnValue({ maintenance: { enabled: true } });

    const req = { path: '/verify.html' };
    const res = {};
    const next = jest.fn();

    maintenanceMode(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow access to /maintenance.html during maintenance mode', () => {
    read.mockReturnValue({ maintenance: { enabled: true } });

    const req = { path: '/maintenance.html' };
    const res = {};
    const next = jest.fn();

    maintenanceMode(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow access to /auth.html during maintenance mode', () => {
    read.mockReturnValue({ maintenance: { enabled: true } });

    const req = { path: '/auth.html' };
    const res = {};
    const next = jest.fn();

    maintenanceMode(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow access to /api/auth/* during maintenance mode', () => {
    read.mockReturnValue({ maintenance: { enabled: true } });

    const req = { path: '/api/auth/verify' };
    const res = {};
    const next = jest.fn();

    maintenanceMode(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow access to static assets during maintenance mode', () => {
    read.mockReturnValue({ maintenance: { enabled: true } });

    const req = { path: '/assets/css/styles.css' };
    const res = {};
    const next = jest.fn();

    maintenanceMode(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should allow admins to access any page during maintenance mode', () => {
    read.mockReturnValue({ maintenance: { enabled: true } });

    const req = {
      path: '/admin.html',
      user: { role: 'admin' },
    };
    const res = {};
    const next = jest.fn();

    maintenanceMode(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 503 for API requests during maintenance mode', () => {
    read.mockReturnValue({
      maintenance: { enabled: true, message: 'Under maintenance' },
    });

    const req = { path: '/api/packages' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    maintenanceMode(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Service temporarily unavailable',
      maintenance: true,
      message: 'Under maintenance',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should redirect HTML requests to maintenance page during maintenance mode', () => {
    read.mockReturnValue({ maintenance: { enabled: true } });

    const req = { path: '/index.html' };
    const res = {
      redirect: jest.fn(),
    };
    const next = jest.fn();

    maintenanceMode(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith('/maintenance.html');
    expect(next).not.toHaveBeenCalled();
  });
});
