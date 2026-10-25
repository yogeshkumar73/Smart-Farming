import React, { useState } from 'react';
import { MapPin, Plus, Sprout } from 'lucide-react';
import {
  Farm,
  Field,
  GrowthStage,
  SoilType,
} from '../../types/agriculture';

interface FarmsFieldsViewProps {
  farms: Farm[];
  fields: Field[];
  onCreateFarm: (input: {
    name: string;
    district: string;
    state: string;
    soilType: SoilType;
    areaHectares: number;
  }) => Promise<{ ok: boolean; message: string }>;
  onCreateField: (input: {
    farmId: string;
    name: string;
    crop: string;
    variety: string;
    sowingDate: string;
    growthStage: GrowthStage;
    areaHectares: number;
    moistureThreshold: number;
  }) => Promise<{ ok: boolean; message: string }>;
  onUpdateFieldStage: (
    fieldId: string,
    growthStage: GrowthStage,
    moistureThreshold: number
  ) => Promise<void>;
}

export const FarmsFieldsView: React.FC<FarmsFieldsViewProps> = ({
  farms,
  fields,
  onCreateFarm,
  onCreateField,
  onUpdateFieldStage,
}) => {
  const [showFarmModal, setShowFarmModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Farm Form State
  const [farmName, setFarmName] = useState('');
  const [district, setDistrict] = useState('Karnal District');
  const [stateName, setStateName] = useState('Uttar Pradesh');
  const [soilType, setSoilType] = useState<SoilType>('loamy');
  const [farmArea, setFarmArea] = useState(2.5);

  // Field Form State
  const [parentFarmId, setParentFarmId] = useState(farms[0]?.id || 'FARM-001');
  const [fieldName, setFieldName] = useState('');
  const [crop, setCrop] = useState('Chickpea (Gram)');
  const [variety, setVariety] = useState('Pusa 372');
  const [sowingDate, setSowingDate] = useState('2026-10-10');
  const [growthStage, setGrowthStage] = useState<GrowthStage>('seedling');
  const [fieldArea, setFieldArea] = useState(1.2);
  const [moistureThreshold, setMoistureThreshold] = useState(22.0);

  const handleFarmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onCreateFarm({
      name: farmName,
      district,
      state: stateName,
      soilType,
      areaHectares: Number(farmArea),
    });
    setFeedbackMsg({
      type: res.ok ? 'success' : 'error',
      text: res.message,
    });
    if (res.ok) {
      setFarmName('');
      setShowFarmModal(false);
    }
  };

  const handleFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onCreateField({
      farmId: parentFarmId,
      name: fieldName,
      crop,
      variety,
      sowingDate,
      growthStage,
      areaHectares: Number(fieldArea),
      moistureThreshold: Number(moistureThreshold),
    });
    setFeedbackMsg({
      type: res.ok ? 'success' : 'error',
      text: res.message,
    });
    if (res.ok) {
      setFieldName('');
      setShowFieldModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Farm & Field Parcel Registry
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Blueprint Section 7 & 8: Manage farms, crop varieties, sowing dates, phenological growth stages, and field moisture thresholds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowFarmModal((prev) => !prev);
              setShowFieldModal(false);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Farm
          </button>

          <button
            type="button"
            onClick={() => {
              setShowFieldModal((prev) => !prev);
              setShowFarmModal(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Register Crop Field
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          role="status"
          className={`p-3.5 rounded-xl text-xs border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Register Farm Form */}
      {showFarmModal && (
        <form
          onSubmit={handleFarmSubmit}
          className="bg-white p-5 rounded-xl border border-slate-300 grid grid-cols-1 md:grid-cols-5 gap-4 items-end"
        >
          <div>
            <label
              htmlFor="new-farm-name"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Farm Name
            </label>
            <input
              id="new-farm-name"
              type="text"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="e.g., West Canal Farm"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label
              htmlFor="new-farm-district"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              District
            </label>
            <input
              id="new-farm-district"
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label
              htmlFor="new-farm-soil"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Soil Type
            </label>
            <select
              id="new-farm-soil"
              value={soilType}
              onChange={(e) => setSoilType(e.target.value as SoilType)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            >
              <option value="loamy">Loamy</option>
              <option value="alluvial">Alluvial</option>
              <option value="clay">Clay</option>
              <option value="sandy">Sandy</option>
              <option value="silty">Silty</option>
              <option value="black_cotton">Black Cotton</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="new-farm-area"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Area (Hectares)
            </label>
            <input
              id="new-farm-area"
              type="number"
              step="0.1"
              value={farmArea}
              onChange={(e) => setFarmArea(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
            >
              Save Farm
            </button>
            <button
              type="button"
              onClick={() => setShowFarmModal(false)}
              className="px-3 py-2 text-xs text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Register Field Form */}
      {showFieldModal && (
        <form
          onSubmit={handleFieldSubmit}
          className="bg-white p-5 rounded-xl border border-slate-300 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label
              htmlFor="new-field-farm"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Parent Farm
            </label>
            <select
              id="new-field-farm"
              value={parentFarmId}
              onChange={(e) => setParentFarmId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id} — {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="new-field-name"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Field Parcel Name
            </label>
            <input
              id="new-field-name"
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="e.g., South Plot D"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label
              htmlFor="new-field-crop"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Crop
            </label>
            <input
              id="new-field-crop"
              type="text"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label
              htmlFor="new-field-variety"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Seed Variety
            </label>
            <input
              id="new-field-variety"
              type="text"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label
              htmlFor="new-field-stage"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Growth Stage
            </label>
            <select
              id="new-field-stage"
              value={growthStage}
              onChange={(e) => setGrowthStage(e.target.value as GrowthStage)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            >
              <option value="germination">Germination</option>
              <option value="seedling">Seedling</option>
              <option value="vegetative">Vegetative</option>
              <option value="tillering">Tillering</option>
              <option value="flowering">Flowering</option>
              <option value="grain_filling">Grain Filling</option>
              <option value="maturity">Maturity</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="new-field-threshold"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Moisture Threshold (%)
            </label>
            <input
              id="new-field-threshold"
              type="number"
              step="0.5"
              value={moistureThreshold}
              onChange={(e) => setMoistureThreshold(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label
              htmlFor="new-field-area"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Area (ha)
            </label>
            <input
              id="new-field-area"
              type="number"
              step="0.1"
              value={fieldArea}
              onChange={(e) => setFieldArea(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
            >
              Save Field
            </button>
            <button
              type="button"
              onClick={() => setShowFieldModal(false)}
              className="px-3 py-2 text-xs text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Farms Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {farms.map((farm) => (
          <div
            key={farm.id}
            className="bg-white p-5 rounded-xl border border-slate-200 flex items-start justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="text-xs font-mono text-slate-500">
                {farm.id} · Soil: {farm.soilType} · Total Area: {farm.areaHectares} ha
              </div>
              <h3 className="text-lg font-bold text-slate-900">{farm.name}</h3>
              <p className="text-xs text-slate-600 inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {farm.location.district}, {farm.location.state}
              </p>
            </div>
            <div className="text-right font-mono tabular-nums text-xs text-slate-500">
              {fields.filter((f) => f.farmId === farm.id).length} Registered Parcels
            </div>
          </div>
        ))}
      </div>

      {/* Fields Table with Inline Stage & Threshold Tuning */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Sprout className="w-4 h-4 text-emerald-700" />
          <h3 className="text-base font-bold text-slate-900">
            Active Crop Fields & Agronomic Rule Thresholds
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Field ID / Name</th>
                <th className="py-3 px-4">Crop & Variety</th>
                <th className="py-3 px-4">Sowing Date</th>
                <th className="py-3 px-4">Growth Stage (Rule Input)</th>
                <th className="py-3 px-4 text-right">Area</th>
                <th className="py-3 px-4 text-right">Moisture Threshold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {fields.map((field) => (
                <tr key={field.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-slate-900">{field.id}</div>
                    <div className="text-slate-600">{field.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{field.crop}</div>
                    <div className="text-slate-500">{field.variety}</div>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                    {field.sowingDate}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      aria-label={`Growth stage for ${field.name}`}
                      value={field.growthStage}
                      onChange={(e) =>
                        onUpdateFieldStage(
                          field.id,
                          e.target.value as GrowthStage,
                          field.moistureThreshold
                        )
                      }
                      className="px-2.5 py-1 text-xs font-medium bg-slate-100 border border-slate-200 rounded-md"
                    >
                      <option value="germination">Germination</option>
                      <option value="seedling">Seedling</option>
                      <option value="vegetative">Vegetative</option>
                      <option value="tillering">Tillering</option>
                      <option value="flowering">Flowering</option>
                      <option value="grain_filling">Grain Filling</option>
                      <option value="maturity">Maturity</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {field.areaHectares.toFixed(1)} ha
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-800">
                    {field.moistureThreshold.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
