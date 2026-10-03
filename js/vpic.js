// NHTSA public APIs (free, no key). Responses are cached in localStorage so the
// year/make/model picker keeps working offline for vehicles you've looked up before.
const VPIC = (() => {
  const BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles';
  const CACHE = 'navaauto.cache.';

  const COMMON_MAKES = [
    'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ford', 'Genesis',
    'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Lincoln',
    'Mazda', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Porsche', 'Ram', 'Subaru', 'Tesla',
    'Toyota', 'Volkswagen', 'Volvo'
  ];

  async function cachedJson(url) {
    const k = CACHE + url;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      try { localStorage.setItem(k, JSON.stringify(j)); } catch {}
      return j;
    } catch (e) {
      const c = localStorage.getItem(k);
      if (c) return JSON.parse(c);
      throw e;
    }
  }

  async function models(make, year) {
    const url = `${BASE}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
    const j = await cachedJson(url);
    const names = [...new Set((j.Results || []).map(r => r.Model_Name))];
    return names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  async function recalls(make, model, year) {
    const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
    const j = await cachedJson(url);
    return j.results || j.Results || [];
  }

  async function decodeVin(vin) {
    const j = await cachedJson(`${BASE}/DecodeVinValues/${encodeURIComponent(vin)}?format=json`);
    const r = (j.Results || [])[0] || {};
    const disp = r.DisplacementL ? parseFloat(r.DisplacementL).toFixed(1) + 'L' : '';
    const engine = [disp, r.EngineCylinders ? 'V' + r.EngineCylinders : '', r.Turbo === 'Yes' ? 'turbo' : '', r.EngineModel]
      .filter(Boolean).join(' ');
    return { year: r.ModelYear, make: r.Make, model: r.Model, engine, trim: r.Trim };
  }

  return { COMMON_MAKES, models, recalls, decodeVin };
})();
