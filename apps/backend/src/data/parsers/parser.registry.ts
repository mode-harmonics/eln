import { Injectable } from '@nestjs/common';
import { Worksheet } from 'exceljs';
import { CalendarLifeParser } from './calendar-life.parser';
import { DcrTestParser } from './dcr-test.parser';
import { EnergyEfficiencyParser } from './energy-efficiency.parser';
import { FastChargeParser } from './fast-charge.parser';
import { HtCycleParser } from './ht-cycle.parser';
import { DataParser } from './parser.interface';
import { ProcessDataParser } from './process-data.parser';
import { StorageSwellingParser } from './storage-swelling.parser';

/**
 * Holds one instance of each of the 7 battery-science parsers and picks
 * the right one for a given worksheet via detect(). Order matters only in
 * the (rare) case where a sheet's headers could ambiguously match more
 * than one parser; more specific parsers are listed first.
 */
@Injectable()
export class ParserRegistry {
  private readonly parsers: DataParser[] = [
    new CalendarLifeParser(),
    new StorageSwellingParser(),
    new FastChargeParser(),
    new HtCycleParser(),
    new DcrTestParser(),
    new EnergyEfficiencyParser(),
    new ProcessDataParser(),
  ];

  /** Returns the first parser whose detect() matches this sheet, or null. */
  resolve(sheet: Worksheet): DataParser | null {
    return this.parsers.find((parser) => parser.detect(sheet)) ?? null;
  }

  getAll(): DataParser[] {
    return this.parsers;
  }
}