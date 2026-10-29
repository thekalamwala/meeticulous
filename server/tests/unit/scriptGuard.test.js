const { assertNotProd } = require('../../scripts/lib/guard');

describe('assertNotProd', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  test('exits(1) in production', () => {
    process.env.NODE_ENV = 'production';
    const spy = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    expect(() => assertNotProd('seed')).toThrow('exit');
    expect(spy).toHaveBeenCalledWith(1);
    spy.mockRestore();
  });

  test('does nothing in development', () => {
    process.env.NODE_ENV = 'development';
    const spy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    assertNotProd('seed');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
