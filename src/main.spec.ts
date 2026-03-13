describe('bootstrap', () => {
  it('creates app, registers validation pipe, and listens on 3000', async () => {
    const useGlobalPipes = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const create = jest.fn().mockResolvedValue({
      useGlobalPipes,
      listen,
    });

    jest.resetModules();
    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create,
      },
    }));

    await import('./main');
    await new Promise((resolve) => setImmediate(resolve));

    expect(create).toHaveBeenCalledTimes(1);
    expect(useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(useGlobalPipes.mock.calls[0][0]?.constructor?.name).toBe(
      'ValidationPipe',
    );
    expect(listen).toHaveBeenCalledWith(3000);
  });
});
