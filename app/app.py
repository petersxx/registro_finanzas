from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os, io, csv

app = Flask(__name__)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(basedir, "finanzas.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ... (tus imports y config igual)

# Sugerencia: Usa datetime.now para hora local si prefieres
class Transaccion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    concepto = db.Column(db.String(100), nullable=False)
    monto = db.Column(db.Float, nullable=False)
    tipo = db.Column(db.String(10), nullable=False)
    fecha = db.Column(db.DateTime, default=datetime.now) # Hora local

# ... (tus rutas igual, solo asegúrate de que el CSV procese bien los tipos)

    def to_dict(self):
        return {
            "id": self.id,
            "concepto": self.concepto,
            "monto": self.monto,
            "tipo": self.tipo,
            "fecha": self.fecha.strftime("%Y-%m-%d %H:%M:%S")
        }

with app.app_context():
    db.create_all()

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/transacciones", methods=["GET"])
def get_transacciones():
    transacciones = Transaccion.query.order_by(Transaccion.fecha.desc()).all()
    return jsonify([t.to_dict() for t in transacciones])

@app.route("/api/transacciones", methods=["POST"])
def add_transaccion():
    data = request.json
    nueva = Transaccion(
        concepto=data["concepto"],
        monto=float(data["monto"]),
        tipo=data["tipo"]
    )
    db.session.add(nueva)
    db.session.commit()
    return jsonify(nueva.to_dict()), 201

@app.route("/api/transacciones/<int:id>", methods=["DELETE"])
def delete_transaccion(id):
    t = Transaccion.query.get(id)
    if not t:
        return jsonify({"error": "No encontrada"}), 404
    db.session.delete(t)
    db.session.commit()
    return "", 204

@app.route("/api/importar-csv", methods=["POST"])
def importar_csv():
    if "file" not in request.files:
        return jsonify({"error": "No se adjuntó archivo"}), 400
    file = request.files["file"]
    
    try:
        # Leemos el archivo usando latin-1 para que reconozca la Ñ y acentos
        content = file.read().decode("latin-1")
        lines = content.splitlines()
        
        count = 0
        # Empezamos desde la línea 8 (índice 7 en Python)
        for i in range(8, len(lines)):
            row = lines[i].split(";")
            
            # Verificamos que la fila tenga los datos necesarios
            if len(row) < 5:
                continue
                
            # Columnas según tu archivo:
            # 0: Fecha Operación, 2: Descripción, 4: Importe
            fecha_str = row[0].strip()
            concepto = row[2].strip()
            monto_raw = row[4].strip()
            
            if not monto_raw:
                continue

            try:
                # Limpieza específica para Guaraníes/Formato PY:
                # Quitamos los puntos de miles para que '100.000' sea '100000'
                # Luego reemplazamos coma por punto por si acaso hay decimales
                monto_limpio = monto_raw.replace(".", "").replace(",", ".")
                monto_final = float(monto_limpio)
                
                # Determinamos tipo
                tipo = "ingreso" if monto_final >= 0 else "egreso"
                
                # Opcional: Convertir fecha_str a objeto datetime si quieres
                # fecha_dt = datetime.strptime(fecha_str, "%d/%m/%y")

                nueva = Transaccion(
                    concepto=concepto, 
                    monto=abs(monto_final), 
                    tipo=tipo
                    # fecha=fecha_dt # Si decides usar la fecha del banco
                )
                db.session.add(nueva)
                count += 1
            except ValueError:
                continue 

        db.session.commit()
        return jsonify({"mensaje": f"Se importaron {count} movimientos con éxito"}), 201

    except Exception as e:
        return jsonify({"error": f"Error al procesar: {str(e)}"}), 500
if __name__ == "__main__":
    app.run(debug=True, port=5600)
