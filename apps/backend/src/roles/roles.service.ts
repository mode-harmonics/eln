import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';

@Injectable()
export class RolesService {
  constructor(@InjectRepository(Role) private readonly rolesRepo: Repository<Role>) {}

  async findAll(page?: number, limit?: number, search?: string): Promise<any> {
    if (page === undefined && limit === undefined) {
      return this.rolesRepo.find({ order: { name: 'ASC' } });
    }

    const pageNum = page ? parseInt(page as any, 10) : 1;
    const limitNum = limit ? parseInt(limit as any, 10) : 10;

    const query = this.rolesRepo.createQueryBuilder('role');

    if (search) {
      query.andWhere('LOWER(role.name) LIKE :search', {
        search: `%${search.toLowerCase()}%`,
      });
    }

    query.orderBy('role.name', 'ASC');

    const skip = (pageNum - 1) * limitNum;
    query.skip(skip).take(limitNum);

    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  async update(id: string, permissionList: string[]): Promise<Role> {
    const role = await this.rolesRepo.findOne({ where: { id } });
    if (!role) throw new Error('Role not found.');
    role.permissionList = permissionList;
    return this.rolesRepo.save(role);
  }
}