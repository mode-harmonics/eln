import { NotFoundException } from '@nestjs/common';
import { ReagentProcurementService } from './reagent-procurement.service';

describe('ReagentProcurementService', () => {
  let service: ReagentProcurementService;

  const procurementRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const designRepo = {
    find: jest.fn(),
  };
  const workflowService = {
    assertStepNotCompleted: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReagentProcurementService(
      procurementRepo as any,
      designRepo as any,
      workflowService as any,
    );
  });

  describe('updateBatch', () => {
    it('applies per-item partial updates and saves all records', async () => {
      workflowService.assertStepNotCompleted.mockResolvedValue(undefined);
      const rec1 = { id: 'a', supplier: 'Old1', batchNo: null, isValid: true };
      const rec2 = { id: 'b', supplier: 'Old2', batchNo: null, isValid: true };
      procurementRepo.find.mockResolvedValue([rec1, rec2]);
      procurementRepo.save.mockImplementation((rows) => Promise.resolve(rows));

      const result = await service.updateBatch('proj-1', [
        { id: 'a', supplier: 'NewSupplier' },
        { id: 'b', isValid: false },
      ]);

      expect(workflowService.assertStepNotCompleted).toHaveBeenCalledWith(
        'proj-1',
        'procurement',
      );
      expect(procurementRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ projectId: 'proj-1' }) }),
      );
      expect(rec1.supplier).toBe('NewSupplier');
      expect(rec2.isValid).toBe(false);
      expect(procurementRepo.save).toHaveBeenCalledWith([rec1, rec2]);
      expect(result).toEqual([rec1, rec2]);
    });

    it('returns [] for empty items without touching the workflow', async () => {
      const result = await service.updateBatch('proj-1', []);

      expect(result).toEqual([]);
      expect(workflowService.assertStepNotCompleted).not.toHaveBeenCalled();
      expect(procurementRepo.find).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a record does not belong to the project', async () => {
      workflowService.assertStepNotCompleted.mockResolvedValue(undefined);
      procurementRepo.find.mockResolvedValue([{ id: 'a' }]);

      await expect(
        service.updateBatch('proj-1', [{ id: 'a' }, { id: 'ghost' }]),
      ).rejects.toThrow(NotFoundException);
      expect(procurementRepo.save).not.toHaveBeenCalled();
    });
  });
});
