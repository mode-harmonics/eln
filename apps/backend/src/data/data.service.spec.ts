import { BadRequestException } from '@nestjs/common';
import { DataService } from './data.service';

describe('DataService high-temperature cycle updates', () => {
  const id = 'ht-row-1';
  let row: Record<string, unknown>;
  let service: DataService;

  beforeEach(() => {
    row = {
      id,
      experimentId: null,
      ironDissolution: null,
      ironDissolutionStage: null,
    };
    const repository = {
      metadata: {
        columns: [
          { propertyName: 'id' },
          { propertyName: 'experimentId' },
          { propertyName: 'ironDissolution' },
          { propertyName: 'ironDissolutionStage' },
          { propertyName: 'createdAt' },
        ],
      },
      target: class HtCycle {},
      findOne: jest.fn(async () => row),
      save: jest.fn(async (value) => value),
    };
    const dataSource = { getRepository: jest.fn(() => repository) };
    (dataSource as any).transaction = async (work: any) => work({ getRepository: dataSource.getRepository });
    service = new DataService(dataSource as any, {} as any, {} as any, {} as any);
  });

  it('rejects iron dissolution without a measurement stage', async () => {
    await expect(service.updateRow('htcycle', id, { ironDissolution: '1.2' }))
      .rejects.toThrow(BadRequestException);
  });

  it('stores iron dissolution with a valid stage', async () => {
    await expect(service.updateRow('htcycle', id, {
      ironDissolution: '1.2',
      ironDissolutionStage: 'initial',
    })).resolves.toMatchObject({ ironDissolution: '1.2', ironDissolutionStage: 'initial' });
  });

  it('rejects an unsupported iron dissolution stage', async () => {
    await expect(service.updateRow('htcycle', id, {
      ironDissolution: '1.2',
      ironDissolutionStage: 'middle',
    })).rejects.toThrow(BadRequestException);
  });

  it('applies the same stage validation to batch edits', async () => {
    const repository = (service as any).dataSource.getRepository();
    repository.find = jest.fn(async () => [row]);

    await expect(service.batchUpdateRows('htcycle', [{ id, ironDissolution: '1.2' }]))
      .rejects.toThrow(BadRequestException);
  });
});
