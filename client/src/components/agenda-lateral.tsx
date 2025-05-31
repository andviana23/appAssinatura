import React, { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";

interface AgendaLateralProps {
  onDataSelecionada?: (data: Date) => void;
  agendamentos?: Array<{ data: string }>;
}

export default function AgendaLateral({
  onDataSelecionada,
  agendamentos = [],
}: AgendaLateralProps) {
  const [dataSelecionada, setDataSelecionada] = useState(new Date());

  // Converte as datas dos agendamentos para string YYYY-MM-DD
  const datasOcupadas = agendamentos.map(item =>
    dayjs(item.data).format("YYYY-MM-DD")
  );

  function handleDiaClick(day: Date | undefined) {
    if (!day) return;
    setDataSelecionada(day);
    if (onDataSelecionada) {
      onDataSelecionada(day);
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "20px",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        minWidth: "320px",
        margin: "16px 0",
      }}
    >
      <h3
        style={{
          fontWeight: "bold",
          fontSize: "18px",
          marginBottom: "12px",
          color: "#365e78",
        }}
      >
        Agenda por Categorias
      </h3>

      <DayPicker
        mode="single"
        selected={dataSelecionada}
        onSelect={handleDiaClick}
        modifiers={{
          ocupada: (date) =>
            datasOcupadas.includes(dayjs(date).format("YYYY-MM-DD")),
        }}
        modifiersClassNames={{
          ocupada: "ocupada",
        }}
        weekStartsOn={0}
        showOutsideDays
        footer={
          <div style={{ marginTop: "12px" }}>
            <Button
              style={{
                background: "#365e78",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 20px",
                cursor: "pointer",
              }}
              onClick={() => alert("Exibir horários disponíveis")}
            >
              Horários disponíveis
            </Button>
          </div>
        }
      />

      <style>
        {`
          .ocupada {
            background-color: #d3b791 !important;
            color: #fff !important;
            border-radius: 50%;
          }
          .rdp-day_selected:not([disabled]) { 
            background: #365e78 !important;
            color: #fff !important;
            border-radius: 50%;
          }
        `}
      </style>

      <div style={{ marginTop: "24px" }}>
        <Button
          style={{
            width: "100%",
            background: "#eee",
            border: "none",
            borderRadius: "6px",
            padding: "8px 0",
            marginBottom: "8px",
            cursor: "pointer",
          }}
        >
          Lista de Agendamentos
        </Button>
        <Button
          style={{
            width: "100%",
            background: "#d3b791",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "8px 0",
            cursor: "pointer",
          }}
        >
          Lista de Espera
        </Button>
      </div>
    </div>
  );
}