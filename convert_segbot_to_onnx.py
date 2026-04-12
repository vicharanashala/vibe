import torch
import torch.nn as nn
import torch.nn.functional as F
# numpy and scipy.signal are not strictly needed for the model definition itself for ONNX export
# import numpy as np
# from scipy.signal import find_peaks

class Encoder(nn.Module):
    def __init__(self, input_dim, hidden_dim):
        super(Encoder, self).__init__()
        self.hidden_dim = hidden_dim
        self.bigru = nn.GRU(input_dim, hidden_dim, bidirectional=True, batch_first=True)

    def forward(self, x):
        h, _ = self.bigru(x)
        return h

class Decoder(nn.Module):
    def __init__(self, hidden_dim):
        super(Decoder, self).__init__()
        self.hidden_dim = hidden_dim
        self.gru = nn.GRU(hidden_dim * 2, hidden_dim, batch_first=True) # Input is concatenation of encoder outputs

    def forward(self, x, hidden_state):
        d, hidden_state = self.gru(x, hidden_state)
        return d, hidden_state

class Pointer(nn.Module):
    def __init__(self, encoder_hidden_dim, decoder_hidden_dim):
        super(Pointer, self).__init__()
        self.W1 = nn.Linear(encoder_hidden_dim, decoder_hidden_dim)
        self.W2 = nn.Linear(decoder_hidden_dim, decoder_hidden_dim)
        self.v = nn.Linear(decoder_hidden_dim, 1, bias=False)

    def forward(self, encoder_outputs, decoder_state): # decoder_state shape: (batch_size, decoder_hidden_dim)
        # self.W1(encoder_outputs) shape: (batch_size, seq_len, decoder_hidden_dim)
        # self.W2(decoder_state) shape: (batch_size, decoder_hidden_dim)
        # Unsqueeze and expand W2 output to allow broadcasted addition
        expanded_decoder_state = self.W2(decoder_state).unsqueeze(1).expand_as(self.W1(encoder_outputs))
        scores = self.v(torch.tanh(self.W1(encoder_outputs) + expanded_decoder_state))
        attention_weights = F.softmax(scores, dim=1) # Softmax over sequence dimension
        return attention_weights

class SEGBOT(nn.Module):
    def __init__(self, input_dim, hidden_dim):
        super(SEGBOT, self).__init__()
        self.encoder = Encoder(input_dim, hidden_dim)
        self.decoder = Decoder(hidden_dim) # Decoder hidden_dim is the same as Encoder's hidden_dim (not *2)
        self.pointer = Pointer(hidden_dim * 2, hidden_dim) # encoder_hidden_dim is hidden_dim * 2

    def forward(self, input_x, start_units_tensor):
        encoder_outputs = self.encoder(input_x) # Shape: (batch_size, seq_len, hidden_dim * 2)
        
        batch_size = input_x.size(0)
        # Initial decoder hidden state: (1, batch_size, decoder_hidden_dim)
        decoder_hidden = torch.zeros(1, batch_size, self.decoder.hidden_dim).to(input_x.device)
        
        # Get start_index as Python scalar for slicing, assuming start_units_tensor is 0-D
        # This makes start_index a constant during tracing for ONNX export, which is required for slicing.
        start_index = start_units_tensor.item() 
        # Decoder input: (batch_size, 1, hidden_dim * 2)
        decoder_inputs = encoder_outputs[:, start_index:start_index+1, :] 

        # decoder_outputs shape: (batch_size, 1, decoder_hidden_dim)
        # hidden_state shape: (1, batch_size, decoder_hidden_dim)
        decoder_outputs, _ = self.decoder(decoder_inputs, decoder_hidden)
        
        # Squeeze decoder_outputs to (batch_size, decoder_hidden_dim) for Pointer network
        squeezed_decoder_outputs = decoder_outputs.squeeze(1)
        
        attention_weights = self.pointer(encoder_outputs, squeezed_decoder_outputs) # attention_weights shape: (batch_size, seq_len, 1)
        return attention_weights

# --- Conversion part of the script ---
def create_segbot_onnx(onnx_file_path="segbot.onnx"):
    input_dim = 128
    hidden_dim = 256
    model = SEGBOT(input_dim, hidden_dim)
    model.eval() # Set model to evaluation mode

    # Dummy inputs matching the forward method signature (input_x, start_units_tensor)
    # batch_size=1, sequence_length=50 (arbitrary sequence length for dummy input)
    dummy_x = torch.randn(1, 50, input_dim) 
    
    # start_units_tensor should be a 0-D tensor for .item() to work and for scalar-like input
    dummy_start_units = torch.tensor(0, dtype=torch.long) 

    input_names = ["input_x", "start_units"]
    output_names = ["attention_weights"]
    
    # Define dynamic axes for batch_size and sequence_length
    # For attention_weights, the output is (batch_size, seq_len, 1).
    # So, sequence_length is dim 1.
    dynamic_axes = {
        "input_x": {0: "batch_size", 1: "sequence_length"},
        "start_units": {}, # Scalar, no dynamic axes
        "attention_weights": {0: "batch_size", 1: "sequence_length"}
    }

    print(f"Exporting SEGBOT model to {onnx_file_path}...")
    torch.onnx.export(
        model,
        (dummy_x, dummy_start_units), # Tuple of inputs
        onnx_file_path,
        export_params=True, # Store learned parameters in the ONNX file
        opset_version=11,   # A commonly used opset version
        do_constant_folding=True, # Optimize by folding constants
        input_names=input_names,
        output_names=output_names,
        dynamic_axes=dynamic_axes,
    )
    print(f"SEGBOT ONNX export complete. Model saved to {onnx_file_path}")

if __name__ == "__main__":
    # This part is for making the script runnable
    # It requires torch to be installed in the environment where it's run.
    try:
        # Re-importing torch, nn, F here is not strictly necessary as they are imported at the top.
        # However, it's kept as per the prompt's structure.
        import torch
        import torch.nn as nn
        import torch.nn.functional as F
        create_segbot_onnx()
    except ImportError:
        print("PyTorch is not installed. This script requires PyTorch to run.")
        print("Please install PyTorch and try again.")
    except Exception as e:
        print(f"An error occurred during SEGBOT ONNX conversion: {e}")
