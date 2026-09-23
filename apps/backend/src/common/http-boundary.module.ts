import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { HttpParametersPipe } from './pipes/http-parameters.pipe';

@Module({ providers: [{ provide: APP_PIPE, useClass: HttpParametersPipe }] })
export class HttpBoundaryModule {}
