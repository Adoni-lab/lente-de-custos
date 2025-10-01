import React, { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart,
  Pie, Cell
} from "recharts";
import * as XLSX from "xlsx";
import * as htmlToImage from "html-to-image";
import jsPDF from "jspdf";
import "./App.css";

type Entry = {
  fornecedor: string;
  valorInicial: number;
  valorFinal: number;
  contaRazao?: string;
  area?: string;
  mesAno?: string;
  periodo?: string;
};

const COLORS = ["#1e3a8a", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

function App() {
  const [data, setData] = useState<Entry[]>([]);
  const [fornecedorInicial, setFornecedorInicial] = useState("");
  const [valorInicial, setValorInicial] = useState<number | "">("");
  const [fornecedorFinal, setFornecedorFinal] = useState("");
  const [valorFinal, setValorFinal] = useState<number | "">("");
  const [contaRazao, setContaRazao] = useState("");
  const [area, setArea] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState("");
  const [periodo, setPeriodo] = useState("");

  const barRef = useRef<HTMLDivElement>(null);
  const pieRef = useRef<HTMLDivElement>(null);
  const contaRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const anos = Array.from({ length: 11 }, (_, i) => 2025 + i);

  const limparTexto = (texto: string) => {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9À-ÿ,.!?()\-\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (typeof bstr !== "string" && !(bstr instanceof ArrayBuffer)) return;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws) as any[];
      const importedData = json.map((row) => ({
        fornecedor: row["Fornecedor"] || "",
        valorInicial: Number(row["Valor Cotado (R$)"]) || 0,
        valorFinal: Number(row["Valor Final (R$)"]) || 0,
        contaRazao: row["Conta Razão"] || "",
        area: row["Área"] || "",
        mesAno: row["Mês/Ano"] || "",
        periodo: row["Período"] || "",
      }));
      setData(importedData);
    };
    reader.readAsBinaryString(file);
  };

  const handleAdd = () => {
    if (fornecedorInicial && valorInicial && fornecedorFinal && valorFinal) {
      setData([
        ...data,
        {
          fornecedor: `${fornecedorInicial} → ${fornecedorFinal}`,
          valorInicial: Number(valorInicial),
          valorFinal: Number(valorFinal),
          contaRazao,
          area,
          mesAno: mes && ano ? `${mes}/${ano}` : "",
          periodo,
        },
      ]);
      setFornecedorInicial("");
      setValorInicial("");
      setFornecedorFinal("");
      setValorFinal("");
      setContaRazao("");
      setArea("");
      setMes("");
      setAno("");
      setPeriodo("");
    }
  };

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleAdd();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [fornecedorInicial, valorInicial, fornecedorFinal, valorFinal, contaRazao, area, mes, ano, periodo, data]);
  const totalInicial = data.reduce((acc, curr) => acc + curr.valorInicial, 0);
  const totalFinal = data.reduce((acc, curr) => acc + curr.valorFinal, 0);
  const economia = totalInicial - totalFinal;

  const contaMaisUsada = data.reduce((map, item) => {
    map[item.contaRazao || "Não informada"] =
      (map[item.contaRazao || "Não informada"] || 0) + item.valorFinal;
    return map;
  }, {} as { [key: string]: number });

  const contaTop = Object.keys(contaMaisUsada).reduce((a, b) =>
    contaMaisUsada[a] > contaMaisUsada[b] ? a : b, "Nenhuma"
  );

  const valorContaTop = contaMaisUsada[contaTop] || 0;

  const exportToExcel = () => {
    const formattedData = data.map((item) => ({
      "Fornecedor": item.fornecedor,
      "Valor Cotado (R$)": item.valorInicial,
      "Valor Final (R$)": item.valorFinal,
      "Conta Razão": item.contaRazao || "",
      "Área": item.area || "",
      "Mês/Ano": item.mesAno || "",
      "Período": item.periodo || "",
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, "ecotrack.xlsx");
  };

  const exportToPDF = async () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = 10;

pdf.setFont("helvetica", "bold"); // Apenas no título
pdf.setFontSize(18);
pdf.text("Relatório de Negociações", pageWidth / 2, y, { align: "center" });
pdf.setFont("helvetica", "normal"); // Volta ao normal para o corpo do texto

    y += 10;

    const addImage = async (ref: React.RefObject<HTMLDivElement>) => {
      if (ref.current) {
        const imgData = await htmlToImage.toPng(ref.current, {
          pixelRatio: 3,
          backgroundColor: "#ffffff"
        });
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = 180;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, "PNG", 15, y, pdfWidth, pdfHeight);

        y += pdfHeight + 10;
      }
    };

    await addImage(pieRef);
    await addImage(barRef);
    await addImage(contaRef);

    pdf.addPage();
    y = 20;
    pdf.setFontSize(16);
    pdf.text("Análise do Relatório", pageWidth / 2, y, { align: "center" });
    y += 10;

    pdf.setFontSize(12);
    const lineHeight = 7;

    data.forEach((item) => {
      const economiaAbs = item.valorInicial - item.valorFinal;
      const economiaPerc = item.valorInicial > 0 ? (economiaAbs / item.valorInicial) * 100 : 0;

      const texto = [
        `Analisou-se a negociação referente a ${limparTexto(item.fornecedor)}.`,
        `Na área ${limparTexto(item.area || "não informada")}, vinculada à conta ${limparTexto(item.contaRazao || "não informada")},`,
        `em ${item.mesAno || "período não informado"}.`,
        `O valor inicialmente cotado foi de ${item.valorInicial.toLocaleString("pt-BR", {
          style: "currency", currency: "BRL"
        })}, enquanto o valor final ficou em ${item.valorFinal.toLocaleString("pt-BR", {
          style: "currency", currency: "BRL"
        })}, gerando uma economia de ${economiaAbs.toLocaleString("pt-BR", {
          style: "currency", currency: "BRL"
        })} (${economiaPerc.toFixed(2)}%).`
      ];

      texto.forEach((linha) => {
        const lines = pdf.splitTextToSize(linha, 180);
        lines.forEach((l) => {
          if (y > 280) {
            pdf.addPage();
            y = 20;
          }
          pdf.text(l, 15, y);
          y += lineHeight;
        });
      });

      y += 5;
    });

    const economiaGeral = totalInicial - totalFinal;
    const economiaGeralPerc = totalInicial > 0 ? (economiaGeral / totalInicial) * 100 : 0;

    const consolidado = [
      `No consolidado geral, o valor total cotado foi de ${totalInicial.toLocaleString("pt-BR", {
        style: "currency", currency: "BRL"
      })}, enquanto o valor final negociado foi de ${totalFinal.toLocaleString("pt-BR", {
        style: "currency", currency: "BRL"
      })}.`,
      `Esse resultado representou uma economia absoluta de ${economiaGeral.toLocaleString("pt-BR", {
        style: "currency", currency: "BRL"
      })}, equivalente a ${economiaGeralPerc.toFixed(2)}%. A conta mais utilizada foi ${contaTop}.`
    ];

    y += 5;
    consolidado.forEach((linha) => {
      const lines = pdf.splitTextToSize(linha, 180);
      lines.forEach((l) => {
        if (y > 280) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(l, 15, y);
        y += lineHeight;
      });
    });

    pdf.save("relatorio_ecotrack.pdf");
  };
  return (
    <div className="container">
      <h1>Relatório Comparativo</h1>

      <div className="btn-group">
        <button className="btn btn-red" onClick={() => setData([])}>Limpar tudo</button>
        <button className="btn btn-orange" onClick={() => setData((prev) => prev.slice(0, -1))}>Limpar último</button>
        <button className="btn btn-green" onClick={exportToExcel}>Exportar Excel</button>
        <button className="btn btn-blue" onClick={exportToPDF}>Exportar PDF</button>
      </div>

      <div className="card">
        <h2>Carregar planilha</h2>
        <input type="file" onChange={handleFileUpload} />
      </div>

      <div className="card">
        <h2>Inserção Manual</h2>
        <input type="text" placeholder="Fornecedor (Cotado)" value={fornecedorInicial} onChange={(e) => setFornecedorInicial(e.target.value)} />
        <input type="number" placeholder="Valor Inicial (R$)" value={valorInicial} onChange={(e) => setValorInicial(Number(e.target.value))} />
        <input type="text" placeholder="Fornecedor (Negociado)" value={fornecedorFinal} onChange={(e) => setFornecedorFinal(e.target.value)} />
        <input type="number" placeholder="Valor Final (R$)" value={valorFinal} onChange={(e) => setValorFinal(Number(e.target.value))} />
        <select value={contaRazao} onChange={(e) => setContaRazao(e.target.value)}>
          <option value="">Selecione Conta Razão</option>
          <option value="5110507 Veículos (Veicular)">5110507 Veículos (Veicular)</option>
          <option value="5110503 Partes, Peças e Aces (Veicular)">5110503 Partes, Peças e Aces (Veicular)</option>
          <option value="5110502 Pneus e Câmaras (Veicular)">5110502 Pneus e Câmaras (Veicular)</option>
          <option value="5210405 Reparo/Cons. (Reparos e Consertos)">5210405 Reparo/Cons. (Reparos e Consertos)</option>
          <option value="5210401 Predial (Predial)">5210401 Predial (Predial)</option>
          <option value="5210404 Móveis/Utens. (Móveis e Utensílios)">5210404 Móveis/Utens. (Móveis e Utensílios)</option>
          <option value="5210403 Equipamentos (Equipamentos)">5210403 Equipamentos (Equipamentos)</option>
          <option value="5211915 Limpeza e Conservação (Limpeza e Conservação)">5211915 Limpeza e Conservação (Limpeza e Conservação)</option>
          <option value="5111923 Indenização P/Danos (Danos)">5111923 Indenização P/Danos (Danos)</option>
        </select>
        <select value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Selecione Área</option>
          <option value="CD Torquato">CD Torquato</option>
          <option value="CD Turismo">CD Turismo</option>
          <option value="CD 3">CD 3</option>
          <option value="Loja">Loja</option>
          <option value="Escritório">Escritório</option>
          <option value="Farma">Farma</option>
        </select>
        <select value={mes} onChange={(e) => setMes(e.target.value)}>
          <option value="">Selecione Mês</option>
          {meses.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={ano} onChange={(e) => setAno(e.target.value)}>
          <option value="">Selecione Ano</option>
          {anos.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <input type="text" placeholder="Período (ex.: Anual, Semestral, Mensal)" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        <button className="btn btn-indigo" onClick={handleAdd}>Adicionar</button>
      </div>

      <div className="card" ref={pieRef}>
        <h2>Gráfico Comparativo – Pizza</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={[
              { name: "Valor Inicial", value: totalInicial },
              { name: "Valor Final", value: totalFinal }
            ]} dataKey="value" outerRadius={100} label>
              {COLORS.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)}
            </Pie>
            <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="card" ref={barRef}>
        <h2>Gráfico Comparativo – Fornecedores</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fornecedor" />
            <YAxis />
            <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
            <Legend />
            <Bar dataKey="valorInicial" fill="#1e3a8a" name="Valor Inicial" />
            <Bar dataKey="valorFinal" fill="#3b82f6" name="Valor Final" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card" ref={contaRef}>
        <h2>Gráfico Comparativo – Conta Razão</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={Object.entries(data.reduce((acc, item) => {
              const key = item.contaRazao || "Não informada";
              if (!acc[key]) acc[key] = { conta: key, valorInicial: 0, valorFinal: 0 };
              acc[key].valorInicial += item.valorInicial;
              acc[key].valorFinal += item.valorFinal;
              return acc;
            }, {} as { [key: string]: { conta: string; valorInicial: number; valorFinal: number } })).map(([_, v]) => v)}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="conta" />
            <YAxis />
            <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
            <Legend />
            <Bar dataKey="valorInicial" fill="#1e3a8a" name="Valor Inicial" />
            <Bar dataKey="valorFinal" fill="#3b82f6" name="Valor Final" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h2>Resumo</h2>
        <p><strong>Valor Cotado:</strong> {totalInicial.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        <p><strong>Valor Final:</strong> {totalFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        <p><strong>Economia Absoluta:</strong> {economia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        <p><strong>% Economizada:</strong> {totalInicial > 0 ? ((economia / totalInicial) * 100).toFixed(2) + "%" : "0%"}</p>
        <p><strong>Conta mais utilizada:</strong> {contaTop} — {valorContaTop.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
      </div>
    </div>
  );
}

export default App;
