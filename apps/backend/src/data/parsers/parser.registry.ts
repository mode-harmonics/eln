import { Injectable } from '@nestjs/common';
import { Worksheet } from 'exceljs';
import { CalendarLifeParser } from './calendar-life.parser';
import { CalendarLifeStepParser } from './calendar-life-step.parser';
import { DcrTestParser } from './dcr-test.parser';
import { DcrTestStepParser } from './dcr-test-step.parser';
import { EnergyEfficiencyParser } from './energy-efficiency.parser';
import { EnergyEfficiencyStepParser } from './energy-efficiency-step.parser';
import { FastChargeParser } from './fast-charge.parser';
import { FastChargeStepParser } from './fast-charge-step.parser';
import { HtCycleParser } from './ht-cycle.parser';
import { HtCycleStepParser } from './ht-cycle-step.parser';
import { DataParser } from './parser.interface';
import { ProcessDataParser } from './process-data.parser';
import { ProcessDataStepParser } from './process-data-step.parser';
import { StorageSwellingParser } from './storage-swelling.parser';

/**
 * Holds one instance of each of the 7 battery-science parsers and picks
 * the right one for a given worksheet via detect(). Order matters only in
 * the (rare) case where a sheet's headers could ambiguously match more
 * than one parser; more specific parsers are listed first.
 */
@Injectable()
export class ParserRegistry {
  private readonly parsers: DataParser<any>[] = [
    new CalendarLifeStepParser(),
    new DcrTestStepParser(),
    new EnergyEfficiencyStepParser(),
    new FastChargeStepParser(),
    new HtCycleStepParser(),
    new ProcessDataStepParser(),
    new CalendarLifeParser(),
    new FastChargeParser(),
    new DcrTestParser(),
    new EnergyEfficiencyParser(),
    new ProcessDataParser(),
    new HtCycleParser(),
    new StorageSwellingParser(),
  ];

  /** Returns the first parser whose detect() matches this sheet, or null. */
  resolve(sheet: Worksheet, assayType?: string): DataParser<any> | null {
    return this.parsers.find((parser) => parser.detect(sheet, assayType)) ?? null;
  }

  getAll(): DataParser<any>[] {
    return this.parsers;
  }
}