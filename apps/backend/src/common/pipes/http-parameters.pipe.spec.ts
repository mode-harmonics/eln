import { BadRequestException } from '@nestjs/common';
import { HttpParametersPipe } from './http-parameters.pipe';

describe('HTTP scalar parameter validation', () => {
  const pipe = new HttpParametersPipe();
  it.each([-1, 0, '', '1.5', 'NaN', ['1', '2'], '9007199254740992'])('rejects invalid pagination %p', (value) => {
    expect(() => pipe.transform(value, { type: 'query', data: 'page' })).toThrow(BadRequestException);
  });
  it('bounds limits and preserves omitted pagination and valid values', () => {
    expect(() => pipe.transform('1001', { type: 'query', data: 'limit' })).toThrow(BadRequestException);
    expect(pipe.transform(undefined, { type: 'query', data: 'page' })).toBeUndefined();
    expect(pipe.transform('10', { type: 'query', data: 'limit' })).toBe('10');
  });
  it.each(['id', 'projectId', 'experimentId', 'expId', 'attachmentId'])('rejects malformed %s', (name) => {
    expect(() => pipe.transform('not-a-uuid', { type: 'param', data: name })).toThrow(BadRequestException);
    const id = '7d454c1b-2329-421e-aa80-21f15973a156';
    expect(pipe.transform(id, { type: 'param', data: name })).toBe(id);
  });
  it('does not interpret workflow names or data types as UUIDs', () => {
    expect(pipe.transform('design', { type: 'param', data: 'stepName' })).toBe('design');
  });
});
