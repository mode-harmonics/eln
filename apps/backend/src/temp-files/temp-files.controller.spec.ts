import { NotFoundException } from '@nestjs/common';
import { TempFilesController } from './temp-files.controller';

describe('Temporary file ownership', () => {
  const owner = { id: 'owner' } as any;
  const other = { id: 'other' } as any;
  let controller: TempFilesController;
  let fileId: string;
  beforeEach(async () => {
    controller = new TempFilesController();
    const files = await controller.upload([{ buffer: Buffer.from('synthetic'), originalname: 'review.txt', mimetype: 'text/plain', size: 9 }], owner);
    fileId = files[0].id;
  });
  afterEach(async () => { await (controller.remove as any)(fileId, owner).catch(() => undefined); });
  it('lists only the current user files', async () => {
    expect(await (controller.list as any)(other)).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: fileId })]));
    expect(await (controller.list as any)(owner)).toEqual(expect.arrayContaining([expect.objectContaining({ id: fileId })]));
  });
  it('rejects downloading another user file before opening a stream', async () => {
    const response = { setHeader: jest.fn(), on: jest.fn(), once: jest.fn(), emit: jest.fn(), write: jest.fn(), end: jest.fn() };
    await expect((controller.download as any)(fileId, response, other)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects deleting another user file', async () => {
    await expect((controller.remove as any)(fileId, other)).rejects.toBeInstanceOf(NotFoundException);
  });
});
