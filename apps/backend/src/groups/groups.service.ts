import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { CellGroup } from '../entities/cell-group.entity';
import { CellGroupMember } from '../entities/cell-group-member.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

const GROUP_PALETTE = [
  '#1d74f5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#d946ef',
];

const UNGROUPED_COLOR = '#9ca3af';

export interface GroupAssignment {
  groupId: string | null;
  groupName: string | null;
  color: string;
}

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    @InjectRepository(CellGroup)
    private readonly groupsRepo: Repository<CellGroup>,
    @InjectRepository(CellGroupMember)
    private readonly membersRepo: Repository<CellGroupMember>,
  ) {}

  // ── CRUD ────────────────────────────────────────────────

  async findByProject(projectId: string): Promise<CellGroup[]> {
    return this.groupsRepo.find({
      where: { projectId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(projectId: string, dto: CreateGroupDto): Promise<CellGroup> {
    const existing = await this.groupsRepo.find({
      where: { projectId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    // Auto-assign color if not provided
    let color = dto.color;
    if (!color) {
      const usedColors = new Set(existing.map((g) => g.color));
      color = GROUP_PALETTE.find((c) => !usedColors.has(c)) ?? GROUP_PALETTE[existing.length % GROUP_PALETTE.length];
    }

    const group = this.groupsRepo.create({
      id: uuid(),
      projectId,
      name: dto.name,
      color,
      sortOrder: dto.sortOrder ?? existing.length,
      matchMode: dto.matchMode,
      matchValue: dto.matchMode === 'prefix' ? (dto.matchValue ?? null) : null,
    });

    return this.groupsRepo.save(group);
  }

  async update(id: string, dto: UpdateGroupDto): Promise<CellGroup> {
    const group = await this.groupsRepo.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Cell group not found: ${id}`);
    }

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.color !== undefined) group.color = dto.color;
    if (dto.sortOrder !== undefined) group.sortOrder = dto.sortOrder;
    if (dto.matchMode !== undefined) group.matchMode = dto.matchMode;
    if (dto.matchValue !== undefined) {
      group.matchValue = dto.matchMode === 'prefix' ? dto.matchValue : null;
    }

    return this.groupsRepo.save(group);
  }

  async delete(id: string): Promise<void> {
    const group = await this.groupsRepo.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Cell group not found: ${id}`);
    }

    // Delete members first
    await this.membersRepo.delete({ groupId: id });
    await this.groupsRepo.remove(group);
  }

  // ── Group member management ─────────────────────────────

  async assignCellToGroup(groupId: string, cellIdentifier: string): Promise<void> {
    const group = await this.groupsRepo.findOne({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException(`Cell group not found: ${groupId}`);
    }

    // Remove any existing manual assignment for this cell
    await this.membersRepo.delete({ cellIdentifier });

    const member = this.membersRepo.create({
      id: uuid(),
      groupId,
      cellIdentifier,
    });
    await this.membersRepo.save(member);
  }

  async unassignCellFromGroup(cellIdentifier: string): Promise<void> {
    await this.membersRepo.delete({ cellIdentifier });
  }

  async getMembers(groupId: string): Promise<CellGroupMember[]> {
    return this.membersRepo.find({ where: { groupId } });
  }

  // ── Cell resolution ─────────────────────────────────────

  /**
   * Resolve which group a given cell belongs to within a project.
   *
   * Resolution priority:
   * 1. Manual assignment (cellGroupMember table)
   * 2. Prefix matching (cellGroup.matchMode='prefix', cells starting with matchValue)
   * 3. Ungrouped (null)
   */
  async getGroupForCell(cellIdentifier: string, projectId: string): Promise<GroupAssignment> {
    // 1. Check manual assignment
    const member = await this.membersRepo.findOne({
      where: { cellIdentifier },
      relations: [],
    });
    if (member) {
      const group = await this.groupsRepo.findOne({ where: { id: member.groupId } });
      if (group) {
        return { groupId: group.id, groupName: group.name, color: group.color };
      }
    }

    // 2. Prefix matching
    const groups = await this.groupsRepo.find({
      where: { projectId, matchMode: 'prefix' },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    // Find the longest matching prefix (most specific match wins)
    let bestMatch: CellGroup | null = null;
    let bestLen = 0;
    for (const g of groups) {
      if (g.matchValue && cellIdentifier.startsWith(g.matchValue) && g.matchValue.length > bestLen) {
        bestMatch = g;
        bestLen = g.matchValue.length;
      }
    }

    if (bestMatch) {
      return { groupId: bestMatch.id, groupName: bestMatch.name, color: bestMatch.color };
    }

    // 3. Ungrouped
    return { groupId: null, groupName: null, color: UNGROUPED_COLOR };
  }

  /**
   * Resolve groups for multiple cell identifiers at once (batch).
   * More efficient than calling getGroupForCell repeatedly.
   */
  async getGroupMap(
    cellIdentifiers: string[],
    projectId: string,
  ): Promise<Record<string, GroupAssignment>> {
    const uniqueCells = [...new Set(cellIdentifiers)];

    // Fetch all manual members + prefix groups in one go
    const manualMembers = await this.membersRepo.find({
      where: uniqueCells.map((ci) => ({ cellIdentifier: ci })),
    });
    const manualGroupIds = [...new Set(manualMembers.map((m) => m.groupId))];
    const manualGroups = manualGroupIds.length > 0
      ? await this.groupsRepo.find({ where: { id: In(manualGroupIds) } })
      : [];
    const manualGroupMap = new Map(manualGroups.map((g) => [g.id, g]));

    const prefixGroups = await this.groupsRepo.find({
      where: { projectId, matchMode: 'prefix' },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    const result: Record<string, GroupAssignment> = {};

    for (const ci of uniqueCells) {
      // Manual match
      const member = manualMembers.find((m) => m.cellIdentifier === ci);
      if (member) {
        const g = manualGroupMap.get(member.groupId);
        if (g) {
          result[ci] = { groupId: g.id, groupName: g.name, color: g.color };
          continue;
        }
      }

      // Prefix match
      let bestMatch: CellGroup | null = null;
      let bestLen = 0;
      for (const g of prefixGroups) {
        if (g.matchValue && ci.startsWith(g.matchValue) && g.matchValue.length > bestLen) {
          bestMatch = g;
          bestLen = g.matchValue.length;
        }
      }
      if (bestMatch) {
        result[ci] = { groupId: bestMatch.id, groupName: bestMatch.name, color: bestMatch.color };
        continue;
      }

      // Ungrouped
      result[ci] = { groupId: null, groupName: null, color: UNGROUPED_COLOR };
    }

    return result;
  }
}
