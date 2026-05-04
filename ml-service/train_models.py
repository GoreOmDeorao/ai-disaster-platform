import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
import os, pickle

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.makedirs("models", exist_ok=True)

WINDOW = 24
BATCH  = 256
EPOCHS = 10

def build_sequences(values, window):
    X, y = [], []
    for i in range(len(values) - window):
        X.append(values[i:i+window])
        y.append(values[i+window])
    return np.array(X), np.array(y)

def build_model(window):
    model = tf.keras.Sequential([
        tf.keras.layers.LSTM(64, return_sequences=True, input_shape=(window, 1)),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.LSTM(32),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(16, activation="relu"),
        tf.keras.layers.Dense(1, activation="sigmoid"),
    ])
    model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
    return model

def train(sensor_type):
    print(f"\n{'='*50}")
    print(f"Training {sensor_type.upper()} LSTM model...")
    df = pd.read_csv(f"data/{sensor_type}_data.csv")
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(df[["value"]])
    X, y = build_sequences(scaled, WINDOW)
    y_labels = df["label"].values[WINDOW:]
    X_train, X_test, y_train, y_test = train_test_split(X, y_labels, test_size=0.2, random_state=42)
    model = build_model(WINDOW)
    model.summary()
    cb = [
        tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True),
        tf.keras.callbacks.ModelCheckpoint(f"models/{sensor_type}_best.h5", save_best_only=True)
    ]
    model.fit(X_train, y_train, validation_data=(X_test, y_test),
              epochs=EPOCHS, batch_size=BATCH, callbacks=cb, verbose=1)
    loss, acc = model.evaluate(X_test, y_test, verbose=0)
    print(f"✅ {sensor_type.upper()} — Test Accuracy: {acc:.4f}")
    model.save(f"models/{sensor_type}_lstm.h5")
    with open(f"models/{sensor_type}_scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)
    print(f"✅ Saved: models/{sensor_type}_lstm.h5 + scaler")

for sensor in ["flood", "seismic", "fire", "gas"]:
    train(sensor)

print("\n✅ All 4 LSTM models trained and saved!")
