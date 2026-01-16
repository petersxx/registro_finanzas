// 1. VARIABLE GLOBAL: Se coloca fuera para que el gráfico persista entre actualizaciones
let miGrafico;

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form-transaccion");
    const lista = document.getElementById("lista-transacciones");
    const totalIngresos = document.getElementById("total-ingresos");
    const totalEgresos = document.getElementById("total-egresos");
    const balanceTotal = document.getElementById("balance-total");
    const resumenMensual = document.getElementById("resumen-mensual");

    // 2. NUEVA FUNCIÓN: Lógica para dibujar el gráfico
    const actualizarGrafico = (ingresos, egresos) => {
        const ctx = document.getElementById('graficoBalance').getContext('2d');
        
        // Si ya existe un gráfico previo, lo destruimos para evitar superposiciones
        if (miGrafico) {
            miGrafico.destroy();
        }

        miGrafico = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Ingresos', 'Egresos'],
                datasets: [{
                    label: 'Total en GS',
                    data: [ingresos, egresos],
                    backgroundColor: ['rgba(40, 167, 69, 0.7)', 'rgba(220, 53, 69, 0.7)'],
                    borderColor: ['#28a745', '#dc3545'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    };

    const cargarTransacciones = async () => {
        const res = await fetch("/api/transacciones");
        const transacciones = await res.json();
        
        let ingresos = 0;
        let egresos = 0;
        
        const grupos = transacciones.reduce((acc, t) => {
            const fecha = t.fecha.split(" ")[0];
            if (!acc[fecha]) acc[fecha] = [];
            acc[fecha].push(t);
            return acc;
        }, {});

        lista.innerHTML = "";
        
        Object.keys(grupos).sort((a, b) => new Date(b) - new Date(a)).forEach(fecha => {
            const headerRow = document.createElement("tr");
            headerRow.className = "table-secondary";
            headerRow.innerHTML = `<td colspan="5" class="fw-bold">📅 ${fecha}</td>`;
            lista.appendChild(headerRow);

            grupos[fecha].forEach(t => {
                if (t.tipo === "ingreso") ingresos += t.monto;
                else egresos += t.monto;

                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${t.fecha.split(" ")[1]}</td>
                    <td>${t.concepto}</td>
                    <td class="${t.tipo === "ingreso" ? "text-success" : "text-danger"} font-weight-bold">
                        ${t.tipo === "ingreso" ? "+" : "-"}$${t.monto.toLocaleString('es-PY')}
                    </td>
                    <td><span class="badge ${t.tipo === "ingreso" ? "bg-success" : "bg-danger"}">${t.tipo}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-secondary" onclick="eliminarTransaccion(${t.id})">🗑️</button>
                    </td>
                `;
                lista.appendChild(row);
            });
        });

        totalIngresos.innerText = `$${ingresos.toLocaleString('es-PY')}`;
        totalEgresos.innerText = `$${egresos.toLocaleString('es-PY')}`;
        balanceTotal.innerText = `$${(ingresos - egresos).toLocaleString('es-PY')}`;
        
        // 3. INTEGRACIÓN: Llamamos al gráfico aquí con los totales calculados
        actualizarGrafico(ingresos, egresos);
        
        generarResumenMensual(transacciones);
    };

    const generarResumenMensual = (transacciones) => {
        const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
        const resumen = {};
        transacciones.forEach(t => {
            const fecha = new Date(t.fecha);
            const clave = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
            if (!resumen[clave]) resumen[clave] = { ingresos: 0, egresos: 0 };
            if (t.tipo === "ingreso") resumen[clave].ingresos += t.monto; else resumen[clave].egresos += t.monto;
        });
        resumenMensual.innerHTML = "";
        Object.keys(resumen).forEach(mes => {
            const item = document.createElement("li");
            item.className = "list-group-item small";
            item.innerHTML = `
                <div class="fw-bold">${mes}</div>
                <div class="text-muted">
                    Ingresaste: <span class="text-success">$${resumen[mes].ingresos.toLocaleString('es-PY')}</span><br>
                    Gastaste: <span class="text-danger">$${resumen[mes].egresos.toLocaleString('es-PY')}</span>
                </div>
            `;
            resumenMensual.appendChild(item);
        });
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
            concepto: document.getElementById("concepto").value,
            monto: document.getElementById("monto").value,
            tipo: document.getElementById("tipo").value
        };

        await fetch("/api/transacciones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        form.reset();
        cargarTransacciones();
    });

    window.eliminarTransaccion = async (id) => {
        if (confirm("¿Estás seguro de eliminar este registro?")) {
            await fetch(`/api/transacciones/${id}`, { method: "DELETE" });
            cargarTransacciones();
        }
    };

    document.getElementById("form-csv").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("csv-file");
        const file = fileInput.files[0];
        if (!file) {
            alert("Por favor selecciona un archivo CSV");
            return;
        }
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/importar-csv", { method: "POST", body: formData });
        const data = await res.json();
        if (res.ok) { 
            alert(data.mensaje); 
            fileInput.value = ""; 
            cargarTransacciones(); 
        } else { 
            alert("Error: " + data.error); 
        }
    });

    cargarTransacciones();
});