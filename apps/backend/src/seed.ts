import { reportBootstrapError, runProductionBootstrap } from './bootstrap-production';

runProductionBootstrap().catch(reportBootstrapError);
