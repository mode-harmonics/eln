import React from "react";
import { useParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Info, Download, FileText } from "lucide-react";
import { 
  MOCK_EXPERIMENTS, 
  MOCK_PROJECTS, 
  MOCK_USERS
} from "../mockData";
import { 
  ProcessDataTable,
  CalendarLifeTable,
  StorageSwellingTable,
  EnergyEfficiencyTable,
  DcrTestTable,
  FastChargeTable,
  HtCycleTable
} from "../components/ExperimentTables";
import { ExperimentChart } from "../components/ExperimentChart";

export function ExperimentDetail() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const experiment = MOCK_EXPERIMENTS.find((e) => e.id === experimentId);
  const project = MOCK_PROJECTS.find((p) => p.id === experiment?.projectId);
  const author = MOCK_USERS.find((u) => u.id === experiment?.createdBy);

  if (!experiment || !project) return <div className="p-10">Experiment not found</div>;

  const renderTable = () => {
    switch (experiment.metadata.assayType) {
      case "ProcessData":
        return <ProcessDataTable />;
      case "CalendarLife":
        return <CalendarLifeTable />;
      case "StorageSwelling":
        return <StorageSwellingTable />;
      case "EnergyEfficiency":
        return <EnergyEfficiencyTable />;
      case "DcrTest":
        return <DcrTestTable />;
      case "FastCharge":
        return <FastChargeTable />;
      case "HtCycle":
        return <HtCycleTable />;
      default:
        return (
          <div className="p-8 text-center text-sm text-gray-500">
            No mock data available for {experiment.metadata.assayType || 'this type'}.
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link to="/projects" className="hover:text-gray-900">Projects</Link>
          <span>/</span>
          <Link to={`/projects/${project.id}`} className="hover:text-gray-900">{project.name}</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{experiment.title}</span>
        </div>
        
        <div className="flex items-end justify-between">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{experiment.title}</h1>
                <div className="mt-2 flex items-center gap-4 text-[13px] text-gray-500">
                  <span>Author: {author?.fullName}</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>Updated {format(new Date(experiment.updatedAt), "PPp")}</span>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span>v{experiment.versionNo}</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors">
                Export
              </button>
              <button className="px-4 py-1.5 bg-[#1d74f5] text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors">
                Edit Record
              </button>
            </div>
        </div>
        <div className="h-px bg-gray-200 w-full mt-6"></div>
      </div>

      <div className="space-y-8">
        <ExperimentChart assayType={experiment.metadata.assayType || 'Unknown'} />

        {/* Data Table Section */}
        <div className="bg-white border border-gray-200 rounded shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-[15px] font-semibold text-gray-900">Data Table</h2>
            <button className="text-gray-400 hover:text-gray-600">
                <Download className="w-4 h-4" />
            </button>
          </div>
          {renderTable()}
        </div>
      </div>
    </div>
  );
}
