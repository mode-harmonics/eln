import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Attachment } from '../entities/attachment.entity';
import { ExperimentCollaborator } from '../entities/experiment-collaborator.entity';
import { Experiment } from '../entities/experiment.entity';
import { VersionHistory } from '../entities/version-history.entity';
import { SubmitExperimentDto, UpdateExperimentDto } from './dto';

export interface ExperimentDetail extends Experiment {
  attachments: Attachment[];
  collaborators: ExperimentCollaborator[];
}

@Injectable()
export class ExperimentsService {
  constructor(
    @InjectRepository(Experiment) private readonly experimentsRepo: Repository<Experiment>,
    @InjectRepository(Attachment) private readonly attachmentsRepo: Repository<Attachment>,
    @InjectRepository(ExperimentCollaborator)
    private readonly collaboratorsRepo: Repository<ExperimentCollaborator>,
    @InjectRepository(VersionHistory)
    private readonly versionHistoryRepo: Repository<VersionHistory>,
  ) {}

  async findDetail(id: string): Promise<ExperimentDetail> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    const [attachments, collaborators] = await Promise.all([
      this.attachmentsRepo.find({ where: { experimentId: id } }),
      this.collaboratorsRepo.find({ where: { experimentId: id } }),
    ]);

    return { ...experiment, attachments, collaborators };
  }

  /**
   * Auto-save / edit with optimistic locking: the caller must supply the
   * versionNo they last read. If it no longer matches the row in the DB,
   * someone else has saved in the meantime and we reject with 409 rather
   * than silently overwrite their change. On success we increment
   * versionNo and write a full snapshot to versionHistory.
   */
  async update(id: string, userId: string, dto: UpdateExperimentDto): Promise<Experiment> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    if (experiment.versionNo !== dto.versionNo) {
      throw new ConflictException(
        `Stale versionNo: expected ${experiment.versionNo}, received ${dto.versionNo}. Reload and retry.`,
      );
    }

    if (dto.title !== undefined) experiment.title = dto.title;
    if (dto.content !== undefined) experiment.content = dto.content;
    if (dto.metadata !== undefined) experiment.metadata = dto.metadata;

    experiment.versionNo += 1;

    const saved = await this.experimentsRepo.save(experiment);

    await this.versionHistoryRepo.save(
      this.versionHistoryRepo.create({
        id: uuid(),
        experimentId: saved.id,
        versionNumber: saved.versionNo,
        changeSummary: dto.changeSummary ?? null,
        snapshot: JSON.parse(JSON.stringify(saved)),
        updatedBy: userId,
      }),
    );

    return saved;
  }

  /**
   * Locks the experiment for review: Draft -> In Review. Also writes a
   * versionHistory snapshot so the submitted state is auditable.
   */
  async submit(id: string, userId: string, dto: SubmitExperimentDto): Promise<Experiment> {
    const experiment = await this.experimentsRepo.findOne({ where: { id } });
    if (!experiment) {
      throw new NotFoundException('Experiment not found.');
    }

    experiment.status = 'In Review';
    experiment.versionNo += 1;

    const saved = await this.experimentsRepo.save(experiment);

    await this.versionHistoryRepo.save(
      this.versionHistoryRepo.create({
        id: uuid(),
        experimentId: saved.id,
        versionNumber: saved.versionNo,
        changeSummary: dto.changeSummary ?? 'Submitted for review',
        snapshot: JSON.parse(JSON.stringify(saved)),
        updatedBy: userId,
      }),
    );

    return saved;
  }
}