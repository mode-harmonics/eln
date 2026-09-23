import { BadRequestException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('Public error envelope', () => {
  it('does not expose unexpected database error details', () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }), getRequest: () => ({ method: 'GET', path: '/api/v1/example' }) }) };
    new AllExceptionsFilter().catch(new Error('internal table and parameter details'), host as any);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ success: false, statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' });
    new AllExceptionsFilter().catch(new BadRequestException('Invalid page'), host as any);
    expect(json).toHaveBeenLastCalledWith({ success: false, statusCode: 400, message: 'Invalid page', error: 'Bad Request' });
    log.mockRestore();
  });
});
