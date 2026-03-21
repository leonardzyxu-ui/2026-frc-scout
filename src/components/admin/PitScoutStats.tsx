import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { PitScoutData } from '../../types';
import { X, Search } from 'lucide-react';

export default function PitScoutStats() {
  const [data, setData] = useState<PitScoutData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<PitScoutData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/finalPitScout.csv');
      if (response.ok) {
        const text = await response.text();
        const parsedData = parseCSV(text);
        parsedData.sort((a, b) => {
          const numA = parseInt(a.teamNumber) || 0;
          const numB = parseInt(b.teamNumber) || 0;
          return numA - numB;
        });
        setData(parsedData);
      } else {
        console.error("Failed to fetch /finalPitScout.csv");
      }
    } catch (err) {
      console.error("Error fetching pit scout data:", err);
    }
    setLoading(false);
  };

  const cleanStr = (val: string) => {
    if (typeof val !== 'string') return val;
    let s = val.trim();
    
    if (!s || s === '' || s === '?' || s === '？' || s.toLowerCase() === 'unknown' || s.toLowerCase() === 'n/a' || s === '不知道' || s === '不确定' || s === '未定' || s === '待定' || s === '未测' || s === '没测试' || s === '没有测试' || s === '不知道？' || s === '未知' || s.includes('不知道') || s.includes('未测') || s.includes('TBD')) {
      return '\\';
    }
    
    if (s === '无' || s === '没有' || s === '🈚️') return 'None';

    s = s.replace(/无（射不了）/g, 'None (Cannot shoot)');
    s = s.replace(/无/g, 'None');
    s = s.replace(/没有/g, 'None');
    s = s.replace(/是/g, 'Yes');
    s = s.replace(/否/g, 'No');
    s = s.replace(/可以/g, 'Yes');
    s = s.replace(/不可以/g, 'No');
    s = s.replace(/不能/g, 'No');
    s = s.replace(/能/g, 'Yes');
    
    s = s.replace(/所有区域都可以发射/g, 'Anywhere');
    s = s.replace(/某些位置发射/g, 'Specific locations');
    s = s.replace(/定点发射/g, 'Fixed location');
    s = s.replace(/不旋转/g, 'No rotation');
    s = s.replace(/旋转/g, 'Rotation');
    s = s.replace(/地上/g, 'Ground');
    s = s.replace(/第一年/g, '1');
    s = s.replace(/第二年/g, '2');
    s = s.replace(/第三年/g, '3');
    s = s.replace(/第四年/g, '4');
    s = s.replace(/卡线/g, 'Max limit');
    s = s.replace(/满/g, 'Max limit');
    s = s.replace(/公斤/g, 'kg');
    s = s.replace(/磅/g, 'lb');
    s = s.replace(/裸机/g, 'Without bumpers ');
    s = s.replace(/左右/g, ' approx');
    s = s.replace(/固定炮塔/g, 'Fixed');
    s = s.replace(/固定/g, 'Fixed');
    s = s.replace(/正负/g, '+-');
    s = s.replace(/大量一起发射/g, 'Multiple at once');
    s = s.replace(/个球一起射/g, ' balls at once');
    s = s.replace(/挺多/g, 'Many');
    s = s.replace(/或/g, ' or ');
    s = s.replace(/（如果没调好）/g, ' (if not tuned)');
    s = s.replace(/满仓，走不了trench/g, 'Full, cannot cross trench');
    s = s.replace(/手动转的？。/g, 'Manual rotation?');
    s = s.replace(/比规则少0.5/g, '0.5 less than rule');
    
    s = s.replace(/；/g, ';');
    s = s.replace(/，/g, ',');
    s = s.replace(/（/g, '(');
    s = s.replace(/）/g, ')');
    
    return s.trim();
  };

  const fixWeight = (weightStr: string) => {
    if (!weightStr || weightStr === '\\') return weightStr;
    let wStr = weightStr.toLowerCase();
    let hasLb = wStr.includes('lb');
    let hasJin = wStr.includes('斤');
    
    let wNumStr = wStr.replace(/[^0-9.]/g, '');
    let wNum = parseFloat(wNumStr);
    
    if (!isNaN(wNum)) {
      if (hasLb) {
        wNum = wNum * 0.453592;
      } else if (hasJin) {
        wNum = wNum * 0.5;
      } else if (wNum > 52.16) {
        let wKg = wNum * 0.453592;
        if (wKg > 52.16 || wKg < 30) {
          wKg = wNum * 0.5;
        }
        if (wKg <= 52.16 && wKg >= 30) {
          wNum = wKg;
        } else {
          if (wNum > 30000 && wNum <= 52160) {
            wNum = wNum / 1000;
          }
        }
      }
      
      if (wNum > 52.16 || wNum < 20) {
        return '\\';
      } else {
        let prefix = weightStr.includes('Without bumpers') ? 'Without bumpers ' : '';
        return prefix + wNum.toFixed(2) + ' kg';
      }
    }
    return weightStr;
  };

  const fixDimension = (val: string) => {
    if (!val || val === '\\' || val === 'Max limit') return val;
    let dStr = val.toLowerCase();
    let isInch = dStr.includes('in');
    let isMeter = dStr.includes('m') && !dStr.includes('mm') && !dStr.includes('cm');
    
    let dNumStr = dStr.replace(/[^0-9.]/g, '');
    let dNum = parseFloat(dNumStr);
    
    if (!isNaN(dNum)) {
      if (isInch) {
        dNum = dNum * 25.4;
      } else if (isMeter && dNum < 2) {
        dNum = dNum * 1000;
      } else if (dNum > 0 && dNum < 100) {
        dNum = dNum * 10;
      }
      return Math.round(dNum) + ' mm';
    }
    return val;
  };

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    const parsedData: PitScoutData[] = [];
    
    const splitLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    for (let i = 1; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      if (cols.length >= 27) {
        const rawData = {
          id: cols[0] || `auto-${Date.now()}-${i}`,
          teamNumber: cleanStr(cols[6]),
          teamName: cleanStr(cols[7]),
          drivetrainType: cleanStr(cols[8]),
          wheelSpeedRatio: cleanStr(cols[9]),
          maxSpeed: cleanStr(cols[10]),
          length: fixDimension(cleanStr(cols[11])),
          width: fixDimension(cleanStr(cols[12])),
          weight: fixWeight(cleanStr(cols[13])),
          canCrossTrench: cleanStr(cols[14]),
          capacity: cleanStr(cols[15]),
          climbLevel: cleanStr(cols[16]),
          autoL1: cleanStr(cols[17]),
          shootingMethod: cleanStr(cols[18]),
          flywheelsPerTurret: cleanStr(cols[19]),
          turretDoF: cleanStr(cols[20]),
          shootingSpeed: cleanStr(cols[21]),
          shootingLocation: cleanStr(cols[22]),
          canProgramPass: cleanStr(cols[23]),
          estPoints: cleanStr(cols[24]),
          driveTeamExp: cleanStr(cols[25]),
          fuelIntakeMethod: cleanStr(cols[26]),
        };

        if (rawData.teamNumber === '10479' || rawData.teamName?.toLowerCase().includes('powerhouse')) {
          if (rawData.climbLevel === 'L1') rawData.climbLevel = 'None';
        }

        parsedData.push(rawData);
      }
    }
    return parsedData;
  };

  const filteredData = data.filter(item => 
    item.teamNumber.includes(searchQuery) || 
    (item.teamName && item.teamName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800/50 p-4 rounded-xl border border-white/10 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Pit Scouting Data</h2>
          <p className="text-sm text-gray-400">View and manage pit scouting data.</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 w-48"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">Loading data...</div>
        ) : data.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">No pit scouting data found.</div>
        ) : (
          <div className="overflow-auto flex-1 p-0">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-slate-900/80 sticky top-0 z-10 text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Drivetrain</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3">Dimensions</th>
                  <th className="px-4 py-3">Climb</th>
                  <th className="px-4 py-3">Shooting</th>
                  <th className="px-4 py-3">Est. Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredData.map((row, i) => (
                  <tr 
                    key={i} 
                    className="hover:bg-white/10 cursor-pointer transition-colors"
                    onClick={() => setSelectedTeam(row)}
                  >
                    <td className="px-4 py-3 font-bold text-white">{row.teamNumber}</td>
                    <td className="px-4 py-3">{row.teamName}</td>
                    <td className="px-4 py-3">{row.drivetrainType}</td>
                    <td className="px-4 py-3">{row.weight}</td>
                    <td className="px-4 py-3">{row.length} x {row.width}</td>
                    <td className="px-4 py-3">{row.climbLevel}</td>
                    <td className="px-4 py-3">{row.shootingMethod}</td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">{row.estPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTeam && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-white/10 shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <span className="text-emerald-400">{selectedTeam.teamNumber}</span>
                  {selectedTeam.teamName}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedTeam(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Robot Specs</h3>
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div className="text-gray-400">Drivetrain</div>
                    <div className="text-white font-medium">{selectedTeam.drivetrainType}</div>
                    
                    <div className="text-gray-400">Dimensions</div>
                    <div className="text-white font-medium">{selectedTeam.length} x {selectedTeam.width}</div>
                    
                    <div className="text-gray-400">Weight</div>
                    <div className="text-white font-medium">{selectedTeam.weight}</div>
                    
                    <div className="text-gray-400">Max Speed</div>
                    <div className="text-white font-medium">{selectedTeam.maxSpeed}</div>
                    
                    <div className="text-gray-400">Wheel Speed Ratio</div>
                    <div className="text-white font-medium">{selectedTeam.wheelSpeedRatio}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Capabilities</h3>
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div className="text-gray-400">Climb Level</div>
                    <div className="text-white font-medium">{selectedTeam.climbLevel}</div>
                    
                    <div className="text-gray-400">Cross Trench</div>
                    <div className="text-white font-medium">{selectedTeam.canCrossTrench}</div>
                    
                    <div className="text-gray-400">Auto L1</div>
                    <div className="text-white font-medium">{selectedTeam.autoL1}</div>
                    
                    <div className="text-gray-400">Program Pass</div>
                    <div className="text-white font-medium">{selectedTeam.canProgramPass}</div>
                    
                    <div className="text-gray-400">Drive Team Exp.</div>
                    <div className="text-white font-medium">{selectedTeam.driveTeamExp}</div>
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Shooting & Intake</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-4 text-sm">
                    <div className="text-gray-400">Shooting Method</div>
                    <div className="text-white font-medium">{selectedTeam.shootingMethod}</div>
                    
                    <div className="text-gray-400">Shooting Location</div>
                    <div className="text-white font-medium">{selectedTeam.shootingLocation}</div>
                    
                    <div className="text-gray-400">Shooting Speed</div>
                    <div className="text-white font-medium">{selectedTeam.shootingSpeed}</div>
                    
                    <div className="text-gray-400">Fuel Intake</div>
                    <div className="text-white font-medium">{selectedTeam.fuelIntakeMethod}</div>
                    
                    <div className="text-gray-400">Capacity</div>
                    <div className="text-white font-medium">{selectedTeam.capacity}</div>
                    
                    <div className="text-gray-400">Turret DoF</div>
                    <div className="text-white font-medium">{selectedTeam.turretDoF}</div>
                    
                    <div className="text-gray-400">Flywheels/Turret</div>
                    <div className="text-white font-medium">{selectedTeam.flywheelsPerTurret}</div>
                    
                    <div className="text-gray-400">Est. Points</div>
                    <div className="text-emerald-400 font-bold">{selectedTeam.estPoints}</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
