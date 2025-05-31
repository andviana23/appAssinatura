import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, User, UserCheck, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Profissional {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  tipo: string;
}

export default function Profissionais() {
  const [, setLocation] = useLocation();

  const { data: barbeiros = [], isLoading } = useQuery({
    queryKey: ["/api/barbeiros"],
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Botão Voltar */}
      <button
        onClick={() => setLocation("/")}
        className="flex items-center gap-2 mb-4 text-[#365e78] hover:text-[#2a4a5e] transition-colors"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "16px",
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#8B4513] mb-2">Profissionais</h1>
        <p className="text-gray-600">
          Gerencie barbeiros e recepcionistas da barbearia
        </p>
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-3 mb-6">
        <Button
          onClick={() => setLocation("/profissionais/novo?tipo=barbeiro")}
          className="bg-[#365e78] hover:bg-[#2a4a5e] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Cadastrar Barbeiro
        </Button>
        <Button
          onClick={() => setLocation("/profissionais/novo?tipo=recepcionista")}
          variant="outline"
          className="border-[#365e78] text-[#365e78] hover:bg-[#365e78] hover:text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Cadastrar Recepcionista
        </Button>
      </div>

      {/* Lista de Profissionais */}
      <div className="grid gap-4">
        {Array.isArray(barbeiros) && barbeiros.length > 0 ? (
          barbeiros.map((profissional: Profissional) => (
            <Card key={profissional.id} className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#8B4513] text-white">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {profissional.nome}
                      </h3>
                      <p className="text-gray-600">{profissional.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Barbeiro
                        </Badge>
                        <Badge 
                          variant={profissional.ativo ? "default" : "secondary"}
                          className={profissional.ativo ? "bg-green-100 text-green-800" : ""}
                        >
                          {profissional.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/profissionais/editar/${profissional.id}`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="shadow-sm">
            <CardContent className="p-12 text-center">
              <UserCheck className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum profissional cadastrado
              </h3>
              <p className="text-gray-600 mb-4">
                Comece cadastrando barbeiros e recepcionistas para sua equipe.
              </p>
              <Button
                onClick={() => setLocation("/profissionais/novo?tipo=barbeiro")}
                className="bg-[#365e78] hover:bg-[#2a4a5e] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Profissional
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}