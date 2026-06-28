import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from '../entities/inventory.entity';
import { v4 as uuid } from 'uuid';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
  ) {}

  async findAll(): Promise<Inventory[]> {
    return this.inventoryRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Inventory> {
    const item = await this.inventoryRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Inventory item not found.');
    }
    return item;
  }

  async create(dto: Partial<Inventory>): Promise<Inventory> {
    const item = this.inventoryRepo.create({
      ...dto,
      id: uuid(),
      status: dto.status || 'In Stock',
    });
    return this.inventoryRepo.save(item);
  }

  async update(id: string, dto: Partial<Inventory>): Promise<Inventory> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.inventoryRepo.save(item);
  }

  async remove(id: string): Promise<void> {
    const item = await this.findOne(id);
    await this.inventoryRepo.remove(item);
  }
}
