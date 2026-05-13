import React, { useState } from 'react';
import { Button, Modal, Input, InputNumber, Tooltip, Empty, Tabs, Switch } from 'antd';
import {
  TableOutlined,
  PictureOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CodeOutlined,
  CloudUploadOutlined
} from '@ant-design/icons';
import { ForgeArtifact } from './types';
import { iconProps } from './iconProps';

const { TextArea } = Input;
const { TabPane } = Tabs;

interface Props {
  artifact: ForgeArtifact;
  onChange: (next: ForgeArtifact) => void;
  /** Hide image controls (e.g. MSR per-source artifact uses tables only). */
  hideImages?: boolean;
}

interface TableDraft {
  rows: number;
  cols: number;
  hasHeader: boolean;
  cells: string[][];
}

const blankTable = (rows = 3, cols = 3, hasHeader = true): TableDraft => ({
  rows,
  cols,
  hasHeader,
  cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''))
});

const tableToHtml = (t: TableDraft): string => {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const headerRow = t.hasHeader ? t.cells[0] : null;
  const bodyRows = t.hasHeader ? t.cells.slice(1) : t.cells;
  const head = headerRow
    ? `<thead><tr>${headerRow.map(c => `<th>${escape(c)}</th>`).join('')}</tr></thead>`
    : '';
  const body = `<tbody>${bodyRows
    .map(row => `<tr>${row.map(c => `<td>${escape(c)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<table class="stoker table-sortable" data-type="sortable">${head}${body}</table>`;
};

const ArtifactEditor: React.FC<Props> = ({ artifact, onChange, hideImages }) => {
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingTableIdx, setEditingTableIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<TableDraft>(blankTable());
  const [rawMode, setRawMode] = useState(false);
  const [rawHtml, setRawHtml] = useState('');

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const openTableBuilder = (existingIdx?: number) => {
    if (existingIdx !== undefined) {
      setEditingTableIdx(existingIdx);
      setRawMode(true);
      setRawHtml(artifact.tablesHtml[existingIdx]);
    } else {
      setEditingTableIdx(null);
      setDraft(blankTable());
      setRawMode(false);
      setRawHtml('');
    }
    setTableModalOpen(true);
  };

  const resizeDraft = (rows: number, cols: number) => {
    const cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => draft.cells[r]?.[c] ?? '')
    );
    setDraft({ ...draft, rows, cols, cells });
  };

  const saveTable = () => {
    const html = rawMode ? rawHtml.trim() : tableToHtml(draft);
    if (!html) {
      setTableModalOpen(false);
      return;
    }
    const next = [...artifact.tablesHtml];
    if (editingTableIdx !== null) next[editingTableIdx] = html;
    else next.push(html);
    onChange({ ...artifact, tablesHtml: next });
    setTableModalOpen(false);
  };

  const removeTable = (idx: number) => {
    const next = artifact.tablesHtml.filter((_, i) => i !== idx);
    onChange({ ...artifact, tablesHtml: next });
  };

  const addImage = () => {
    if (!imageUrl.trim()) return;
    onChange({ ...artifact, imageUrls: [...artifact.imageUrls, imageUrl.trim()] });
    setImageUrl('');
    setImageModalOpen(false);
  };

  const removeImage = (idx: number) => {
    onChange({ ...artifact, imageUrls: artifact.imageUrls.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      {/* Description */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Artifact description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <Input
          value={artifact.description}
          onChange={e => onChange({ ...artifact, description: e.target.value })}
          placeholder="Short caption for the chart/table (optional)"
        />
      </div>

      {/* Tables */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Data tables <span className="text-gray-400 font-normal">({artifact.tablesHtml.length})</span>
          </span>
          <Button icon={<PlusOutlined  {...iconProps} />} size="small" onClick={() => openTableBuilder()}>
            Add table
          </Button>
        </div>
        {artifact.tablesHtml.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-400 text-sm bg-gray-50">
            <TableOutlined className="text-2xl mb-1 block"  {...iconProps} /> No tables added.
          </div>
        ) : (
          <div className="space-y-2">
            {artifact.tablesHtml.map((html, idx) => (
              <div key={idx} className="border rounded-lg p-2 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">Table #{idx + 1}</span>
                  <div className="flex gap-1">
                    <Tooltip title="Edit raw HTML">
                      <Button size="small" icon={<EditOutlined  {...iconProps} />} onClick={() => openTableBuilder(idx)} />
                    </Tooltip>
                    <Tooltip title="Remove">
                      <Button size="small" danger icon={<DeleteOutlined  {...iconProps} />} onClick={() => removeTable(idx)} />
                    </Tooltip>
                  </div>
                </div>
                <div
                  className="overflow-x-auto text-sm artifact-table-preview"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Images */}
      {!hideImages && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Images / graphs <span className="text-gray-400 font-normal">({artifact.imageUrls.length})</span>
            </span>
            <div className="flex gap-2">
              <Tooltip title="Native upload — coming soon">
                <Button icon={<CloudUploadOutlined  {...iconProps} />} size="small" disabled>
                  Upload
                </Button>
              </Tooltip>
              <Button icon={<PlusOutlined  {...iconProps} />} size="small" onClick={() => setImageModalOpen(true)}>
                Add image URL
              </Button>
            </div>
          </div>
          {artifact.imageUrls.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-400 text-sm bg-gray-50">
              <PictureOutlined className="text-2xl mb-1 block"  {...iconProps} /> No images added.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {artifact.imageUrls.map((src, idx) => (
                <div key={idx} className="relative border rounded-lg overflow-hidden bg-gray-50">
                  <img
                    src={src}
                    alt={`Artifact ${idx + 1}`}
                    className="w-full h-32 object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
                  />
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined  {...iconProps} />}
                    className="!absolute !top-1 !right-1"
                    onClick={() => removeImage(idx)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table builder modal */}
      <Modal
        title={editingTableIdx !== null ? 'Edit table' : 'Add table'}
        open={tableModalOpen}
        onCancel={() => setTableModalOpen(false)}
        onOk={saveTable}
        okText="Save table"
        width={720}
      >
        <Tabs
          activeKey={rawMode ? 'raw' : 'grid'}
          onChange={k => setRawMode(k === 'raw')}
        >
          <TabPane tab={<><TableOutlined  {...iconProps} /> Grid builder</>} key="grid">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm">Rows</span>
              <InputNumber min={1} max={20} value={draft.rows} onChange={v => resizeDraft(Number(v) || 1, draft.cols)} />
              <span className="text-sm">Cols</span>
              <InputNumber min={1} max={10} value={draft.cols} onChange={v => resizeDraft(draft.rows, Number(v) || 1)} />
              <span className="text-sm ml-3">Header row</span>
              <Switch checked={draft.hasHeader} onChange={v => setDraft({ ...draft, hasHeader: v })} />
            </div>
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-sm">
                <tbody>
                  {draft.cells.map((row, r) => (
                    <tr key={r} className={r === 0 && draft.hasHeader ? 'bg-gray-100' : ''}>
                      {row.map((cell, c) => (
                        <td key={c} className="border p-1">
                          <Input
                            value={cell}
                            size="small"
                            bordered={false}
                            className={r === 0 && draft.hasHeader ? 'font-semibold' : ''}
                            onChange={e => {
                              const cells = draft.cells.map(row2 => [...row2]);
                              cells[r][c] = e.target.value;
                              setDraft({ ...draft, cells });
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabPane>
          <TabPane tab={<><CodeOutlined  {...iconProps} /> Raw HTML</>} key="raw">
            <TextArea
              value={rawHtml}
              onChange={e => setRawHtml(e.target.value)}
              rows={10}
              placeholder='Paste a <table>...</table> snippet'
              className="font-mono text-xs"
            />
            <div className="text-xs text-gray-500 mt-2">
              Use this for tables already extracted from a source (e.g. GMAT Club). The HTML is stored verbatim and rendered as-is.
            </div>
            {rawHtml && (
              <div className="mt-3 border rounded p-2 bg-white">
                <div className="text-xs text-gray-500 mb-1">Preview</div>
                <div className="overflow-x-auto text-sm" dangerouslySetInnerHTML={{ __html: rawHtml }} />
              </div>
            )}
          </TabPane>
        </Tabs>
      </Modal>

      {/* Image modal */}
      <Modal
        title="Add image URL"
        open={imageModalOpen}
        onCancel={() => setImageModalOpen(false)}
        onOk={addImage}
        okText="Add"
      >
        <Input
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
          placeholder="https://…/chart.png"
          autoFocus
        />
        {imageUrl && (
          <div className="mt-3 border rounded p-2 bg-gray-50">
            <img src={imageUrl} alt="preview" className="max-h-64 mx-auto" />
          </div>
        )}
      </Modal>
    </div>
  );
};

const EmptyArtifactState: React.FC<{ hint?: string }> = ({ hint }) => (
  <Empty description={hint || 'No artifact yet'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
);

export { EmptyArtifactState };
export default ArtifactEditor;
