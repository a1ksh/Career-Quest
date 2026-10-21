import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEmployees, importProfile } from '../api/client';
import type { Employee } from '../api/types';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { SectionCard, gradeLabel } from '../components/Ui';
export function EmployeeSelector() {
  const [employees, setEmployees] = useState<Employee[]>([]),
    [query, setQuery] = useState(''),
    [department, setDepartment] = useState(''),
    [grade, setGrade] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<unknown>(null),
    [retryKey, setRetryKey] = useState(0),
    [profileFile, setProfileFile] = useState<File | null>(null),
    [importing, setImporting] = useState(false),
    [importError, setImportError] = useState<string | null>(null),
    [importedId, setImportedId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getEmployees().then(items => {
      if (active) setEmployees(items);
    }).catch((reason: unknown) => {
      if (active) setError(reason);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [retryKey]);
  const retry = () => {
      setLoading(true);
      setError(null);
      setRetryKey(key => key + 1);
    };
  const resetFilters = () => {
    setQuery('');
    setDepartment('');
    setGrade('');
  };
  const departments = [...new Set(employees.map(item => item.department).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, 'ru'));
  const gradeOrder = ['Junior', 'Middle', 'Senior', 'Lead'];
  const grades = [...new Set(employees.map(item => item.grade))].sort((a, b) => {
    const aIndex = gradeOrder.indexOf(a), bIndex = gradeOrder.indexOf(b);
    return (aIndex < 0 ? gradeOrder.length : aIndex) - (bIndex < 0 ? gradeOrder.length : bIndex) || a.localeCompare(b, 'ru');
  });
  const searchTerms = query.trim().toLocaleLowerCase('ru').split(/\s+/).filter(Boolean);
  const visible = employees.filter(item => {
    const text = `${item.employee_id} ${item.full_name} ${item.role} ${item.department ?? ''}`.toLocaleLowerCase('ru');
    return (!department || item.department === department) && (!grade || item.grade === grade) && searchTerms.every(term => text.includes(term));
  }).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru') || a.employee_id.localeCompare(b.employee_id));
  const hasFilters = Boolean(query || department || grade);
  async function uploadProfile() {
    if (!profileFile || importing) return;
    setImporting(true);
    setImportError(null);
    setImportedId(null);
    try {
      let payload: unknown;
      try {
        payload = JSON.parse(await profileFile.text()) as unknown;
      } catch {
        throw new Error('Некорректный JSON-файл. Выберите файл с профилем сотрудника.');
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('JSON должен содержать профиль сотрудника или объект с полями employee и history.');
      }
      const result = await importProfile(payload);
      setImportedId(result.employee_id);
      resetFilters();
      setLoading(true);
      setError(null);
      setRetryKey(key => key + 1);
    } catch (problem) {
      setImportError(problem instanceof Error ? problem.message : 'Не удалось загрузить профиль.');
    } finally {
      setImporting(false);
    }
  }
  return <div className="page-stack">
    <div className="hero"><span className="eyebrow">ВАШ СЛЕДУЮЩИЙ ШАГ НАЧИНАЕТСЯ ЗДЕСЬ</span><h1>Выберите <span>карьерный путь.</span></h1><p>Откройте профиль, узнайте о дефицитах навыков и выберите квест для развития.</p></div>
    <details className="profile-import">
      <summary>Загрузить тестовый профиль</summary>
      <div className="profile-import-body">
        <p className="muted">Выберите JSON-объект сотрудника из схемы employees.json. Для истории используйте объект с полями employee и history (массив записей activity_history.csv).</p>
        <label className="search-label" htmlFor="profile-file">Выберите JSON-файл</label>
        <input id="profile-file" type="file" accept=".json,application/json" onChange={e => setProfileFile(e.target.files?.[0] ?? null)} />
        <div className="quest-actions"><button className="button button-secondary" type="button" disabled={!profileFile || importing} onClick={uploadProfile}>{importing ? 'Загрузка…' : 'Загрузить профиль'}</button></div>
        {importError && <p className="completion-error" role="alert">{importError}</p>}
        {importedId && <p role="status">Профиль успешно загружен: <Link className="back-link" to={`/employee/${encodeURIComponent(importedId)}`}>{importedId} → открыть профиль</Link></p>}
      </div>
    </details>
    <SectionCard title="Выберите сотрудника" eyebrow="КАРЬЕРНЫЕ ПРОФИЛИ" action={!loading && !error && <span className="count-pill">Доступно: {employees.length}</span>}>
      {loading ? <LoadingState label="Загрузка сотрудников..." /> : error ? <ErrorState error={error} onRetry={retry} /> : employees.length === 0 ? <EmptyState title="Сотрудников пока нет" message="Сервер вернул пустой список сотрудников." /> : <>
        <div className="employee-filters">
          <div className="employee-search-field"><label className="search-label" htmlFor="employee-search">Поиск сотрудников</label>
            <input id="employee-search" className="search-input" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Имя, роль, отдел или ID" aria-controls="employee-results" /></div>
          <label htmlFor="employee-department">Отдел<select id="employee-department" value={department} onChange={e => setDepartment(e.target.value)} aria-controls="employee-results"><option value="">Все отделы</option>{departments.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label htmlFor="employee-grade">Грейд<select id="employee-grade" value={grade} onChange={e => setGrade(e.target.value)} aria-controls="employee-results"><option value="">Все грейды</option>{grades.map(value => <option key={value} value={value}>{gradeLabel(value)}</option>)}</select></label>
          <button className="button button-secondary" type="button" onClick={resetFilters} disabled={!hasFilters}>Сбросить фильтры</button>
        </div>
        <p className="employee-results-count muted" role="status" aria-live="polite" aria-atomic="true">Найдено: {visible.length} из {employees.length} · По имени А–Я</p>
        <div id="employee-results">{visible.length === 0 ? <EmptyState title="Совпадений нет" message="Измените запрос, отдел или грейд либо сбросьте фильтры." /> : <div className="employee-grid">{visible.map(item => <Link className="employee-card" to={`/employee/${encodeURIComponent(item.employee_id)}`} key={item.employee_id}><span className="avatar" aria-hidden="true">{item.full_name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span><span className="employee-card-body"><strong>{item.full_name}</strong><span>{item.role}</span><small>{item.department ?? 'Отдел не указан'} · {gradeLabel(item.grade)}</small></span><span className="card-arrow" aria-hidden="true">↗</span></Link>)}</div>}</div>
      </>}
    </SectionCard>
  </div>;
}
